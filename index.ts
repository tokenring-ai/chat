import TokenRingApp, {TokenRingPlugin} from "@tokenring-ai/app";
import {AgentCommandService} from "@tokenring-ai/agent";
import {z} from "zod";

import chatCommands from "./chatCommands.ts";
import contextHandlers from "./contextHandlers.ts";
import ChatService from "./ChatService.js";
import packageJSON from "./package.json" with {type: "json"};

export const ChatClientConfigSchema = z.object({
  defaultModel: z.string(),
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  async install(app: TokenRingApp) {
    app.waitForService(AgentCommandService, agentCommandService =>
      agentCommandService.addAgentCommands(chatCommands)
    );

    const config = app.getConfigSlice("chat", ChatClientConfigSchema);
    if (config) {
      const chatService = new ChatService({model: config.defaultModel});

      chatService.registerContextHandlers(contextHandlers);

      app.addServices(chatService);
    }
  },
} as TokenRingPlugin;

export {createChatRequest} from "./chatRequestBuilder/createChatRequest.ts";
export {default as ChatService} from "./ChatService.ts";
