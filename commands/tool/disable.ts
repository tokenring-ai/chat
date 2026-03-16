import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import joinDefault from "@tokenring-ai/utility/string/joinDefault";
import ChatService from "../../ChatService.ts";

async function execute(remainder: string, agent: Agent): Promise<string> {
  const toolNames = remainder?.trim().split(/\s+/).filter(Boolean);
  if (!toolNames?.length) throw new CommandFailedError("Tool names required. Usage: /tools disable <tool1> <tool2> ...");
  const chatService = agent.requireServiceByType(ChatService);
  chatService.disableTools(toolNames.map(n => chatService.ensureToolNamesLike(n)).flat(), agent);
  return `Enabled tools: ${joinDefault(", ", chatService.getEnabledTools(agent), "(none)")}`;
}

export default {
  name: "tools disable",
  description: "Disable tools",
  aliases: ["tool disable"],
  help: `# /tools disable <tool1> [tool2...]

Disable one or more tools by name.

## Example

/tools disable calculator
/tools disable web-search calculator`, execute } satisfies TokenRingAgentCommand;
