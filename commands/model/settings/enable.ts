import Agent from "@tokenring-ai/agent/Agent";
import {coerceFeatureValue, getModelAndSettings, serializeModel} from "./util.ts";

export default async function enable(remainder: string, agent: Agent): Promise<void> {
  const args = remainder?.trim().split(/\s+/).filter(Boolean);
  if (args.length === 0) {
    agent.errorMessage("/model settings enable requires at least one key or key=value");
    return;
  }

  const {chatService, base, settings} = getModelAndSettings(agent);

  for (const token of args) {
    const eq = token.indexOf("=");
    if (eq === -1) {
      settings[token] = true;
    } else {
      const key = token.substring(0, eq);
      if (!key) { agent.errorMessage(`Invalid feature token: ${token}`); continue; }
      settings[key] = coerceFeatureValue(token.substring(eq + 1));
    }
  }

  const newModel = serializeModel(base, settings);
  chatService.setModel(newModel, agent);
  agent.infoMessage(`Enabled settings. New model: ${newModel}`);
}
