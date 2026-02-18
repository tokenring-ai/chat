import Agent from "@tokenring-ai/agent/Agent";
import {getModelAndSettings, serializeModel} from "./util.ts";

export default async function disable(remainder: string, agent: Agent): Promise<void> {
  const keys = remainder?.trim().split(/\s+/).filter(Boolean);
  if (keys.length === 0) {
    agent.errorMessage("/model settings disable requires at least one key");
    return;
  }

  const {chatService, base, settings} = getModelAndSettings(agent);
  for (const key of keys) delete settings[key];

  const newModel = serializeModel(base, settings);
  chatService.setModel(newModel, agent);
  agent.infoMessage(`Disabled settings. New model: ${newModel}`);
}
