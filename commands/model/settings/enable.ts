import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import {coerceFeatureValue, serializeModel} from "@tokenring-ai/ai-client/util/modelSettings";
import {ChatService} from "../../../index.ts";

async function execute(remainder: string, agent: Agent): Promise<string> {
  const args = remainder?.trim().split(/\s+/).filter(Boolean);
  if (!args?.length) throw new CommandFailedError("/model settings enable requires at least one key or key=value");
  const chatService = agent.requireServiceByType(ChatService);
  const {base, settings} = chatService.getModelAndSettings(agent);
  for (const token of args) {
    const eq = token.indexOf("=");
    if (eq === -1) { settings.set(token, true); }
    else {
      const key = token.substring(0, eq);
      if (!key) throw new CommandFailedError(`Invalid feature token: ${token}`);
      settings.set(key, coerceFeatureValue(token.substring(eq + 1)));
    }
  }
  const newModel = serializeModel(base, settings);
  chatService.setModel(newModel, agent);
  return `Enabled settings. New model: ${newModel}`;
}

export default { name: "model settings enable", description: "/model settings enable - Enable model feature flags", help: `# /model settings enable <key[=value]> ...

Enable one or more model feature flags.

## Example

/model settings enable reasoning
/model settings enable websearch temperature=0.7`, execute } satisfies TokenRingAgentCommand;
