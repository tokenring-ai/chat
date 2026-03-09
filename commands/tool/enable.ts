import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import joinDefault from "@tokenring-ai/utility/string/joinDefault";
import ChatService from "../../ChatService.ts";

async function execute(remainder: string, agent: Agent): Promise<string> {
  const toolNames = remainder?.trim().split(/\s+/).filter(Boolean);
  if (!toolNames?.length) throw new CommandFailedError("Tool names required. Usage: /tools enable <tool1> <tool2> ...");
  const chatService = agent.requireServiceByType(ChatService);
  chatService.enableTools(toolNames.map(n => chatService.ensureToolNamesLike(n)).flat(), agent);
  return `Enabled tools: ${joinDefault(", ", chatService.getEnabledTools(agent), "(none)")}`;
}

export default {
  name: "tools enable",
  description: "/tools enable - Enable tools",
  aliases: ["tool enable"],
  help: `# /tools enable <tool1> [tool2...]

Enable one or more tools by name.

## Example

/tools enable web-search
/tools enable web-search calculator`, execute } satisfies TokenRingAgentCommand;
