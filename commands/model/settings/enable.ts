import Agent from "@tokenring-ai/agent/Agent";
import {coerceFeatureValue, serializeModel} from "@tokenring-ai/ai-client/util/modelSettings";
import {ChatService} from "../../../index.ts";

export default async function enable(remainder: string, agent: Agent): Promise<void> {
  const args = remainder?.trim().split(/\s+/).filter(Boolean);
  if (args.length === 0) {
    agent.errorMessage("/model settings enable requires at least one key or key=value");
    return;
  }

  const chatService = agent.requireServiceByType(ChatService);
  const {base, settings} = chatService.getModelAndSettings(agent);

  for (const token of args) {
    const eq = token.indexOf("=");
    if (eq === -1) {
      settings.set(token, true)
    } else {
      const key = token.substring(0, eq);
      if (!key) { agent.errorMessage(`Invalid feature token: ${token}`); continue; }
      settings.set(key, coerceFeatureValue(token.substring(eq + 1)));
    }
  }

  const newModel = serializeModel(base, settings);
  chatService.setModel(newModel, agent);
  agent.infoMessage(`Enabled settings. New model: ${newModel}`);
}
