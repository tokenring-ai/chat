import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import ChatService from "../../ChatService.ts";

export default {
  name: "model set",
  description: "Set the model",
  help: `# /model set <model_name>

Set the chat model to a specific model by name.

## Example

/model set gpt-5.2`,
  execute: async (remainder: string, agent: Agent): Promise<string> => {
    const modelName = remainder?.trim();
    if (!modelName) throw new CommandFailedError("Model name required. Usage: /model set <model_name>");
    agent.requireServiceByType(ChatService).setModel(modelName, agent);
    return `Model set to ${modelName}`;
  },
} satisfies TokenRingAgentCommand;
