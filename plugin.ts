import {AgentCommandService} from "@tokenring-ai/agent";
import {TokenRingPlugin} from "@tokenring-ai/app";
import {z} from "zod";

import chatCommands from "./chatCommands.ts";
import ChatService from "./ChatService.js";
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
  async install(app, config) {
    app.waitForService(AgentCommandService, agentCommandService =>
      agentCommandService.addAgentCommands(chatCommands)
    );

    if (config.chat) {
      const chatService = new ChatService(app, config.chat);

      chatService.registerContextHandlers(contextHandlers);

      app.addServices(chatService);
    }
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
