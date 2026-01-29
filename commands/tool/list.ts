import Agent from "@tokenring-ai/agent/Agent";
import joinDefault from "@tokenring-ai/utility/string/joinDefault";
import ChatService from "../../ChatService.ts";

export default async function list(_remainder: string, agent: Agent): Promise<void> {
  const chatService = agent.requireServiceByType(ChatService);
  const enabledTools = chatService.getEnabledTools(agent);
  
  agent.infoMessage(
    `Enabled tools: ${joinDefault(", ", enabledTools, "(none)")}`,
  );
}
