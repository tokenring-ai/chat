import {AgentLifecycleService} from "@tokenring-ai/agent";
import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import ChatService from "../../ChatService.ts";
import {ChatServiceState} from "../../state/chatServiceState.ts";

export default {
  name: "chat reset",
  description: "/chat reset - Reset the chat context",
  help: `# /chat reset

Reset the chat context, clearing prior messages and starting a new conversation.

## Example

/chat reset`,
  execute: async (_remainder: string, agent: Agent): Promise<string> => {
    agent.requireServiceByType(ChatService).clearChatMessages(agent);
    return `Chat context reset`;
  },
} satisfies TokenRingAgentCommand;
