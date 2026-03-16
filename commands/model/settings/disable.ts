import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import {serializeModel} from "@tokenring-ai/ai-client/util/modelSettings";
import {ChatService} from "../../../index.ts";

const inputSchema = {
  args: {},
  positionals: [{
    name: "keys",
    description: "Space-separated setting keys to disable",
    required: true,
    greedy: true,
  }],
  allowAttachments: false,
} as const satisfies AgentCommandInputSchema;

async function execute({positionals, agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const keys = positionals.keys.split(/\s+/).filter(Boolean);
  if (!keys.length) throw new CommandFailedError("/model settings disable requires at least one key");
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
