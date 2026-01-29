import Agent from "@tokenring-ai/agent/Agent";
import joinDefault from "@tokenring-ai/utility/string/joinDefault";
import ChatService from "../../ChatService.ts";

export default async function disable(remainder: string, agent: Agent): Promise<void> {
  const chatService = agent.requireServiceByType(ChatService);
  const toolNames = remainder?.trim().split(/\s+/).filter(Boolean);
  
  if (toolNames.length === 0) {
    agent.errorMessage("Tool names required. Usage: /tools disable <tool1> <tool2> ...");
    return;
  }

  const matchedToolNames = toolNames.map(toolName => chatService.ensureToolNamesLike(toolName)).flat();
  chatService.disableTools(matchedToolNames, agent);
  
  agent.infoMessage(
    `Enabled tools: ${joinDefault(", ", chatService.getEnabledTools(agent), "(none)")}`,
  );
}
