import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import joinDefault from "@tokenring-ai/utility/string/joinDefault";
import ChatService from "../../ChatService.ts";

export default async function disable(remainder: string, agent: Agent): Promise<string> {
  const chatService = agent.requireServiceByType(ChatService);
  const toolNames = remainder?.trim().split(/\s+/).filter(Boolean);
  
  if (!toolNames || toolNames.length === 0) {
    throw new CommandFailedError("Tool names required. Usage: /tools disable <tool1> <tool2> ...");
  }

  const matchedToolNames = toolNames.map(toolName => chatService.ensureToolNamesLike(toolName)).flat();
  chatService.disableTools(matchedToolNames, agent);
  
  return `Enabled tools: ${joinDefault(", ", chatService.getEnabledTools(agent), "(none)")}`;
}
