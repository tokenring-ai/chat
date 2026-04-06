import {AgentCommandService} from "@tokenring-ai/agent";
import {TokenRingPlugin} from "@tokenring-ai/app";
import {AgentLifecycleService} from "@tokenring-ai/lifecycle";
import {RpcService} from "@tokenring-ai/rpc";
import {z} from "zod";
import ChatService from "./ChatService.ts";

import agentCommands from "./commands.ts";
import contextHandlers from "./contextHandlers.ts";
import hooks from "./hooks";
import packageJSON from "./package.json" with {type: "json"};
import chatRPC from "./rpc/chat.ts";
import {ChatServiceConfigSchema} from "./schema.ts";
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  chat: ChatServiceConfigSchema
});

export default {
  name: packageJSON.name,
  displayName: "AI Chat Client",
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    app.waitForService(AgentCommandService, agentCommandService =>
      agentCommandService.addAgentCommands(agentCommands)
    );

    const chatService = new ChatService(app, config.chat);

    chatService.registerContextHandlers(contextHandlers);

    app.addServices(chatService);
    chatService.addTools(tools)

    app.waitForService(RpcService, rpcService => {
      rpcService.registerEndpoint(chatRPC);
    });

    // Register hooks with the lifecycle service
    app.waitForService(AgentLifecycleService, lifecycleService => {
      lifecycleService.addHooks(hooks);
    });
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
