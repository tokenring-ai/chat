import Agent from "@tokenring-ai/agent/Agent";
import ChatService from "../../ChatService.ts";

export default async function set(remainder: string, agent: Agent): Promise<void> {
  const chatService = agent.requireServiceByType(ChatService);
  const modelName = remainder?.trim();
  
  if (!modelName) {
    agent.errorMessage("Model name required. Usage: /model set <model_name>");
    return;
  }

  chatService.setModel(modelName, agent);
  agent.infoMessage(`Model set to ${modelName}`);
}
