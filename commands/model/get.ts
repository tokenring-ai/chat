import Agent from "@tokenring-ai/agent/Agent";
import ChatService from "../../ChatService.ts";
import select from "./select.ts";

export default async function show(_remainder: string, agent: Agent): Promise<void> {
  const chatService = agent.requireServiceByType(ChatService);
  const model = chatService.requireModel(agent);
  
  agent.infoLine(`Current model: ${model}`);
}
