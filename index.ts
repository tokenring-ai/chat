import {AgentCommandService, AgentTeam, TokenRingPackage} from "@tokenring-ai/agent";
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
  async install(agentTeam: AgentTeam) {
    agentTeam.waitForService(AgentCommandService, agentCommandService =>
      agentCommandService.addAgentCommands(chatCommands)
    );

    const config = agentTeam.getConfigSlice("chat", ChatClientConfigSchema);
    if (!config) return;

    agentTeam.addServices(new ChatService({model: config.defaultModel}));
  },
} as TokenRingPackage;

export {createChatRequest} from "./chatRequestBuilder/createChatRequest.ts";
export {default as ChatService} from "./ChatService.ts";
