import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import ChatService from "../../ChatService.ts";

export default {
  name: "model get",
  description: "Show current model",
  help: `# /model get

Show the currently active chat model.

## Example

/model get`,
  execute: async (_remainder: string, agent: Agent): Promise<string> =>
    `Current model: ${agent.requireServiceByType(ChatService).getModel(agent) ?? "(none)"}`,
} satisfies TokenRingAgentCommand;
