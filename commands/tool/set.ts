import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import joinDefault from "@tokenring-ai/utility/string/joinDefault";
import ChatService from "../../ChatService.ts";

async function execute(remainder: string, agent: Agent): Promise<string> {
  const toolNames = remainder?.trim().split(/\s+/).filter(Boolean);
  if (!toolNames?.length) throw new CommandFailedError("Tool names required. Usage: /tools set <tool1> <tool2> ...");
  const chatService = agent.requireServiceByType(ChatService);
  chatService.setEnabledTools(toolNames.map(n => chatService.ensureToolNamesLike(n)).flat(), agent);
  return `Enabled tools: ${joinDefault(", ", chatService.getEnabledTools(agent), "(none)")}`;
}

export default {
  name: "tools set",
  description: "Set enabled tools",
  aliases: ["tool set"],
  help: `# /tools set <tool1> [tool2...]

Set exactly which tools are enabled, replacing the current selection.

## Example

/tools set web-search calculator`, execute } satisfies TokenRingAgentCommand;
