import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
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
    agent.mutateState(ChatServiceState, state => {
      state.messages = [];
    })
    return `Chat context reset`;
  },
} satisfies TokenRingAgentCommand;
