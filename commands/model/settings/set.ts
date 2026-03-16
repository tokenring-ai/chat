import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import {coerceFeatureValue, serializeModel} from "@tokenring-ai/ai-client/util/modelSettings";
import ChatService from "../../../ChatService.ts";

const inputSchema = {
  args: {},
  positionals: [{
    name: "token",
    description: "Setting key or key=value pair",
    required: true,
  }],
  allowAttachments: false,
} as const satisfies AgentCommandInputSchema;

async function execute({positionals, agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const token = positionals.token;
  if (!token) throw new CommandFailedError("/model settings set requires a key or key=value");
  const chatService = agent.requireServiceByType(ChatService);
  const {base, settings} = chatService.getModelAndSettings(agent);
  const eq = token.indexOf("=");
  if (eq === -1) { settings.set(token, true); }
  else {
    const key = token.substring(0, eq);
    if (!key) throw new CommandFailedError(`Invalid feature token: ${token}`);
    settings.set(key, coerceFeatureValue(token.substring(eq + 1)));
  }
  const newModel = serializeModel(base, settings);
  chatService.setModel(newModel, agent);
  return `Set feature. New model: ${newModel}`;
}

export default {
  name: "model settings set",
  description: "Set a model feature flag",
  inputSchema,
  execute,
  help: `Set a single model feature flag.

## Example

/model settings set websearch
/model settings set temperature=0.7`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
