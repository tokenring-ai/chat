import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {serializeModel} from "@tokenring-ai/ai-client/util/modelSettings";
import {ChatService} from "../../../index.ts";

export default async function disable(remainder: string, agent: Agent): Promise<string> {
  const keys = remainder?.trim().split(/\s+/).filter(Boolean);
  if (!keys || keys.length === 0) {
    throw new CommandFailedError("/model settings disable requires at least one key");
  }

  const chatService = agent.requireServiceByType(ChatService);
  const {base, settings} = chatService.getModelAndSettings(agent);

  for (const key of keys) settings.delete(key)

  const newModel = serializeModel(base, settings);
  chatService.setModel(newModel, agent);
  return `Disabled settings. New model: ${newModel}`;
}
