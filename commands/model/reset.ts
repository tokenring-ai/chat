import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import ChatService from "../../ChatService.ts";
import {ChatServiceState} from "../../state/chatServiceState.ts";

export default {
  name: "model reset",
  description: "/model reset - Reset to initial model",
  help: `# /model reset

Reset the chat model to the initial configured value.

## Example

/model reset`,
  execute: async (_remainder: string, agent: Agent): Promise<string> => {
    const initialModel = agent.getState(ChatServiceState).initialConfig.model;
    if (!initialModel) throw new CommandFailedError("No initial model configured");
    agent.requireServiceByType(ChatService).setModel(initialModel, agent);
    return `Model reset to ${initialModel}`;
  },
} satisfies TokenRingAgentCommand;
