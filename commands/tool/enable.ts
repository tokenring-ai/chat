import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import joinDefault from "@tokenring-ai/utility/string/joinDefault";
import ChatService from "../../ChatService.ts";

export default async function enable(remainder: string, agent: Agent): Promise<string> {
  const chatService = agent.requireServiceByType(ChatService);
  const toolNames = remainder?.trim().split(/\s+/).filter(Boolean);
  
  if (!toolNames || toolNames.length === 0) {
    throw new CommandFailedError("Tool names required. Usage: /tools enable <tool1> <tool2> ...");
  }

  const matchedToolNames = toolNames.map(toolName => chatService.ensureToolNamesLike(toolName)).flat();
  chatService.enableTools(matchedToolNames, agent);
  
  return `Enabled tools: ${joinDefault(", ", chatService.getEnabledTools(agent), "(none)")}`;
}
