import Agent from "@tokenring-ai/agent/Agent";
import {serializeModel} from "@tokenring-ai/ai-client/util/modelSettings";
import {ChatService} from "../../../index.ts";

export default async function disable(remainder: string, agent: Agent): Promise<void> {
  const keys = remainder?.trim().split(/\s+/).filter(Boolean);
  if (keys.length === 0) {
    agent.errorMessage("/model settings disable requires at least one key");
    return;
  }

  const chatService = agent.requireServiceByType(ChatService);
  const {base, settings} = chatService.getModelAndSettings(agent);

  for (const key of keys) settings.delete(key)

  const newModel = serializeModel(base, settings);
  chatService.setModel(newModel, agent);
  agent.infoMessage(`Disabled settings. New model: ${newModel}`);
}
