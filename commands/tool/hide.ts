import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import joinDefault from "@tokenring-ai/utility/string/joinDefault";
import ChatService from "../../ChatService.ts";

async function execute(remainder: string, agent: Agent): Promise<string> {
  const toolNames = remainder?.trim().split(/\s+/).filter(Boolean);
  if (!toolNames?.length) throw new CommandFailedError("Tool names required. Usage: /tools hide <tool1> <tool2> ...");
  const chatService = agent.requireServiceByType(ChatService);
  chatService.hideTools(toolNames.map(n => chatService.ensureToolNamesLike(n)).flat(), agent);
  return `Hidden tools: ${joinDefault(", ", chatService.getHiddenTools(agent), "(none)")}`;
}

export default { 
  name: "tools hide", 
  description: "/tools hide - Hide tools", 
  aliases: ["tool hide"],
  help: `# /tools hide <tool1> [tool2...]

Hide one or more tools by name, requiring the model to search for the tool to activate it before use.

Saves context in some cases; useful for agents that need access to large numbers of tools.

## Example

/tools hide calculator
/tools hide web-search calculator`,
  execute
} satisfies TokenRingAgentCommand;
