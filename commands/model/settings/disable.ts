import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand,} from "@tokenring-ai/agent/types";
import {serializeModel} from "@tokenring-ai/ai-client/util/modelSettings";
import {ChatService} from "../../../index.ts";

const inputSchema = {
  args: {},
  remainder: {
    name: "keys",
    description: "Space-separated setting keys to disable",
    required: true,
  },
} as const satisfies AgentCommandInputSchema;

function execute({
                   remainder,
                   agent,
                 }: AgentCommandInputType<typeof inputSchema>): string {
  const keys = remainder.split(/\s+/).filter(Boolean);
  if (!keys.length)
    throw new CommandFailedError(
      "/model settings disable requires at least one key",
    );
  const chatService = agent.requireServiceByType(ChatService);
  const {base, settings} = chatService.getModelAndSettings(agent);
  for (const key of keys) settings.delete(key);
  const newModel = serializeModel(base, settings);
  chatService.setModel(newModel, agent);
  return `Disabled settings. New model: ${newModel}`;
}

export default {
  name: "model settings disable",
  description: "Disable model feature flags",
  inputSchema,
  execute,
  help: `Disable one or more model feature flags.

## Example

/model settings disable reasoning
/model settings disable reasoning websearch`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
