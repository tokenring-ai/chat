import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import ChatService from "../../ChatService.ts";

export default async function set(remainder: string, agent: Agent): Promise<string> {
  const chatService = agent.requireServiceByType(ChatService);
  const modelName = remainder?.trim();
  
  if (!modelName) {
    throw new CommandFailedError("Model name required. Usage: /model set <model_name>");
  }

  chatService.setModel(modelName, agent);
  return `Model set to ${modelName}`;
}
