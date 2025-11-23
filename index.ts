import TokenRingApp from "@tokenring-ai/app"; 
import {AgentCommandService} from "@tokenring-ai/agent";
import {TokenRingPlugin} from "@tokenring-ai/app";
import {z} from "zod";

import * as chatCommands from "./chatCommands.ts";
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
    if (!config) return;

    app.addServices(new ChatService({model: config.defaultModel}));
  },
} as TokenRingPlugin;

export {createChatRequest} from "./chatRequestBuilder/createChatRequest.ts";
export {default as ChatService} from "./ChatService.ts";
