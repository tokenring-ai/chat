import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {coerceFeatureValue, serializeModel} from "@tokenring-ai/ai-client/util/modelSettings";
import ChatService from "../../../ChatService.ts";

export default async function set(remainder: string, agent: Agent): Promise<string> {
  const chatService = agent.requireServiceByType(ChatService);
  const token = remainder?.trim();
  if (!token) {
    throw new CommandFailedError("/model settings set requires a key or key=value");
  }

  const {base, settings} = chatService.getModelAndSettings(agent);
  const eq = token.indexOf("=");
  if (eq === -1) {
    settings.set(token, true);
  } else {
    const key = token.substring(0, eq);
    if (!key) {
      throw new CommandFailedError(`Invalid feature token: ${token}`);
    }
    settings.set(key, coerceFeatureValue(token.substring(eq + 1)));
  }

  const newModel = serializeModel(base, settings);
  chatService.setModel(newModel, agent);
  return `Set feature. New model: ${newModel}`;
}
