import { AgentCommandService } from "@tokenring-ai/agent";
import type { TokenRingPlugin } from "@tokenring-ai/app";
import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import { AgentLifecycleService } from "@tokenring-ai/lifecycle";
import { RpcService } from "@tokenring-ai/rpc";
import { z } from "zod";
import ChatService from "./ChatService.ts";
import ContextualSearchService from "./ContextualSearchService.ts";
import agentCommands from "./commands.ts";
import contextHandlers from "./contextHandlers.ts";
import AgentContextualSearchProvider from "./contextualSearch/AgentContextualSearchProvider.ts";
import injectSubagentResults from "./hooks/injectSubagentResults.ts";
import resolveContextualTags from "./hooks/resolveContextualTags.ts";
import packageJSON from "./package.json" with { type: "json" };
import chatRPC from "./rpc/chat.ts";
import { ChatServiceConfigSchema, ChatToolConfigSchema } from "./schema.ts";
import ToolDirectoryService from "./ToolDirectoryService.ts";
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  chat: ChatServiceConfigSchema,
  tools: z.record(z.string(), ChatToolConfigSchema).default({}),
  toolDirectory: z
    .string()
    .default("tools")
    .meta({ description: "Directory where editable tool YAML files are stored" } satisfies ConfigFieldMeta),
});

export default {
  name: packageJSON.name,
  displayName: "AI Chat Client",
  version: packageJSON.version,
  description: packageJSON.description,
  async install(app) {
    app.waitForService(AgentCommandService, agentCommandService => agentCommandService.addAgentCommands(agentCommands));

    const chatService = app.addService(ChatService, new ChatService(app));
    chatService.registerContextHandlers(contextHandlers);
    chatService.addTools(tools);

    const toolDirectoryService = app.addService(ToolDirectoryService, new ToolDirectoryService(app));

    const contextualSearchService = app.addService(ContextualSearchService, new ContextualSearchService());
    contextualSearchService.registerProvider("agent", new AgentContextualSearchProvider(app));

    app.waitForService(RpcService, rpcService => {
      rpcService.registerEndpoint(chatRPC);
    });

    app.waitForService(AgentLifecycleService, lifecycleService => {
      lifecycleService.addHooks(injectSubagentResults, resolveContextualTags);
    });

    // Workspace tools have to be registered before the first reconfigure, so that agents whose
    // enabledTools reference one resolve it on the very first configuration apply.
    await toolDirectoryService.syncToService();
  },
  async reconfigure(app, config) {
    const chatService = app.requireService(ChatService);
    chatService.reconfigure(config.chat);
    chatService.reconfigureTools(config.tools);

    await app.requireService(ToolDirectoryService).reconfigure(config.toolDirectory);
  },
  configSchema: packageConfigSchema,
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
