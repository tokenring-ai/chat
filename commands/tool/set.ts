import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import joinDefault from "@tokenring-ai/utility/string/joinDefault";
import ChatService from "../../ChatService.ts";

const inputSchema = {
  args: {},
  remainder: {name: "toolNames", description: "Space-separated tool names to set as enabled", required: true}
} as const satisfies AgentCommandInputSchema;

async function execute({remainder, agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const toolNames = remainder.split(/\s+/).filter(Boolean);
  if (!toolNames.length) throw new CommandFailedError("Tool names required. Usage: /tools set <tool1> <tool2> ...");
  const chatService = agent.requireServiceByType(ChatService);
  chatService.setEnabledTools(toolNames.map(n => chatService.ensureToolNamesLike(n)).flat(), agent);
  return `Enabled tools: ${joinDefault(", ", chatService.getEnabledTools(agent), "(none)")}`;
}

export default {
  name: "tools set",
  description: "Set enabled tools",
  aliases: ["tool set"],
  inputSchema,
  execute,
  help: `Set exactly which tools are enabled, replacing the current selection.

## Example

/tools set web-search calculator`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
