import {AgentCommandService} from "@tokenring-ai/agent";
import {TokenRingPlugin} from "@tokenring-ai/app";
import {WebHostService} from "@tokenring-ai/web-host";
import JsonRpcResource from "@tokenring-ai/web-host/JsonRpcResource";
import {z} from "zod";

import chatCommands from "./chatCommands.ts";
import ChatService from "./ChatService.js";
import chatRPC from "./rpc/chat.ts";
import contextHandlers from "./contextHandlers.ts";
import packageJSON from "./package.json" with {type: "json"};
import {ChatServiceConfigSchema} from "./schema.ts";

const packageConfigSchema = z.object({
  chat: ChatServiceConfigSchema
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    app.waitForService(AgentCommandService, agentCommandService =>
      agentCommandService.addAgentCommands(chatCommands)
    );

    const chatService = new ChatService(app, config.chat);

    chatService.registerContextHandlers(contextHandlers);

    app.addServices(chatService);

    app.waitForService(WebHostService, webHostService => {
      webHostService.registerResource("Chat RPC endpoint", new JsonRpcResource(app, chatRPC));
    });
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
