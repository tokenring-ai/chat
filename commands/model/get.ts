import {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import ChatService from "../../ChatService.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

async function execute({agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  return `Current model: ${agent.requireServiceByType(ChatService).getModel(agent) ?? "(none)"}`;
}

export default {
  name: "model get",
  description: "Show current model",
  inputSchema,
  execute,
  help: `Show the currently active chat model.

## Example

/model get`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
