import { CommandFailedError } from "@tokenring-ai/agent/AgentError";
import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import joinDefault from "@tokenring-ai/utility/string/joinDefault";
import ChatService from "../../ChatService.ts";

const inputSchema = {
  args: {},
  remainder: {
    name: "toolNames",
    description: "Space-separated tool names to set as enabled",
    required: true,
  },
} as const satisfies AgentCommandInputSchema;

function execute({ remainder, agent }: AgentCommandInputType<typeof inputSchema>): string {
  const toolNames = remainder.split(/\s+/).filter(Boolean);
  if (!toolNames.length) throw new CommandFailedError("Tool names required. Usage: /tools set <tool1> <tool2> ...");
  const chatService = agent.requireServiceByType(ChatService);
  chatService.setEnabledTools(
    toolNames.flatMap(n => chatService.ensureToolNamesLike(n)),
    agent,
  );
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
