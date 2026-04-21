import { CommandFailedError } from "@tokenring-ai/agent/AgentError";
import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import joinDefault from "@tokenring-ai/utility/string/joinDefault";
import ChatService from "../../ChatService.ts";

const inputSchema = {
  args: {},
  remainder: {
    name: "toolNames",
    description: "Space-separated tool names to enable",
    required: true,
  },
} as const satisfies AgentCommandInputSchema;

function execute({ remainder, agent }: AgentCommandInputType<typeof inputSchema>): string {
  const toolNames = remainder.split(/\s+/).filter(Boolean);
  if (!toolNames.length) throw new CommandFailedError("Tool names required. Usage: /tools enable <tool1> <tool2> ...");
  const chatService = agent.requireServiceByType(ChatService);
  chatService.enableTools(
    toolNames.flatMap(n => chatService.ensureToolNamesLike(n)),
    agent,
  );
  return `Enabled tools: ${joinDefault(", ", chatService.getEnabledTools(agent), "(none)")}`;
}

export default {
  name: "tools enable",
  description: "Enable tools",
  aliases: ["tool enable"],
  inputSchema,
  execute,
  help: `Enable one or more tools by name.

## Example

/tools enable web-search
/tools enable web-search calculator`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
