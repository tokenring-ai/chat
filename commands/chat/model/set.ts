import { CommandFailedError } from "@tokenring-ai/agent/AgentError";
import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import ChatService from "../../../ChatService.ts";

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

function execute({ args, agent }: AgentCommandInputType<typeof inputSchema>): string {
  const modelName = args.modelName;
  if (!modelName) throw new CommandFailedError("Model name required. Usage: /model set <model_name>");
  agent.requireService(ChatService).setModel(modelName, agent);
  return `Model set to ${modelName}`;
}

export default {
  name: "chat model set",
  description: "Set the model",
  inputSchema,
  execute,
  help: `Set the chat model to a specific model by name.

## Example

/chat model set gpt-5.2`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
