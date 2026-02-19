import Agent from "@tokenring-ai/agent/Agent";
import {coerceFeatureValue, serializeModel} from "@tokenring-ai/ai-client/util/modelSettings";
import ChatService from "../../../ChatService.ts";

export default async function set(remainder: string, agent: Agent): Promise<void> {
  const chatService = agent.requireServiceByType(ChatService);
  const token = remainder?.trim();
  if (!token) {
    agent.errorMessage("/model settings set requires a key or key=value");
    return;
  }

  const {base, settings} = chatService.getModelAndSettings(agent);
  const eq = token.indexOf("=");
  if (eq === -1) {
    settings.set(token, true);
  } else {
    const key = token.substring(0, eq);
    if (!key) {
      agent.errorMessage(`Invalid feature token: ${token}`);
      return;
    }
    settings.set(key, coerceFeatureValue(token.substring(eq + 1)));
  }

  const newModel = serializeModel(base, settings);
  chatService.setModel(newModel, agent);
  agent.infoMessage(`Set feature. New model: ${newModel}`);
}
