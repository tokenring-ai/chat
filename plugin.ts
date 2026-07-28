import { AgentCommandService } from "@tokenring-ai/agent";
import type { TokenRingPlugin } from "@tokenring-ai/app";
import { AgentLifecycleService } from "@tokenring-ai/lifecycle";
import { RpcService } from "@tokenring-ai/rpc";
import { z } from "zod";
import ChatService from "./ChatService.ts";

import agentCommands from "./commands.ts";
import contextHandlers from "./contextHandlers.ts";
import injectSubagentResults from "./hooks/injectSubagentResults.ts";
import packageJSON from "./package.json" with { type: "json" };
import chatRPC from "./rpc/chat.ts";
import { ChatServiceConfigSchema, ChatToolConfigSchema } from "./schema.ts";
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  chat: ChatServiceConfigSchema,
  tools: z.record(z.string(), ChatToolConfigSchema).default({}),
});

export default {
  name: packageJSON.name,
  displayName: "AI Chat Client",
  version: packageJSON.version,
  description: packageJSON.description,
  install(app) {
    app.waitForService(AgentCommandService, agentCommandService => agentCommandService.addAgentCommands(agentCommands));

    const chatService = new ChatService(app);
    chatService.registerContextHandlers(contextHandlers);
    chatService.addTools(...tools);
    app.addServices(chatService);

    app.waitForService(RpcService, rpcService => {
      rpcService.registerEndpoint(chatRPC);
    });

    app.waitForService(AgentLifecycleService, lifecycleService => {
      lifecycleService.addHooks(injectSubagentResults);
    });
  },
  reconfigure(app, config) {
    const chatService = app.requireService(ChatService);
    chatService.reconfigure(config.chat);
    chatService.reconfigureTools(config.tools);
  },
  configSchema: packageConfigSchema,
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
