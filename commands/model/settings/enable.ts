import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {coerceFeatureValue, serializeModel} from "@tokenring-ai/ai-client/util/modelSettings";
import {ChatService} from "../../../index.ts";

export default async function enable(remainder: string, agent: Agent): Promise<string> {
  const args = remainder?.trim().split(/\s+/).filter(Boolean);
  if (!args || args.length === 0) {
    throw new CommandFailedError("/model settings enable requires at least one key or key=value");
  }

  const chatService = agent.requireServiceByType(ChatService);
  const {base, settings} = chatService.getModelAndSettings(agent);

  for (const token of args) {
    const eq = token.indexOf("=");
    if (eq === -1) {
      settings.set(token, true)
    } else {
      const key = token.substring(0, eq);
      if (!key) { throw new CommandFailedError(`Invalid feature token: ${token}`); }
      settings.set(key, coerceFeatureValue(token.substring(eq + 1)));
    }
  }

  const newModel = serializeModel(base, settings);
  chatService.setModel(newModel, agent);
  return `Enabled settings. New model: ${newModel}`;
}
