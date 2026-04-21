import { CommandFailedError } from "@tokenring-ai/agent/AgentError";
import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import ChatService from "../../ChatService.ts";

const inputSchema = {
  args: {},
  positionals: [
    {
      name: "modelName",
      description: "The model name to set",
      required: true,
    },
  ],
} as const satisfies AgentCommandInputSchema;

function execute({ positionals, agent }: AgentCommandInputType<typeof inputSchema>): string {
  const modelName = positionals.modelName;
  if (!modelName) throw new CommandFailedError("Model name required. Usage: /model set <model_name>");
  agent.requireServiceByType(ChatService).setModel(modelName, agent);
  return `Model set to ${modelName}`;
}

export default {
  name: "model set",
  description: "Set the model",
  inputSchema,
  execute,
  help: `Set the chat model to a specific model by name.

## Example

/model set gpt-5.2`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
