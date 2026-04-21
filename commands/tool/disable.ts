import { CommandFailedError } from "@tokenring-ai/agent/AgentError";
import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import joinDefault from "@tokenring-ai/utility/string/joinDefault";
import ChatService from "../../ChatService.ts";

const inputSchema = {
  args: {},
  remainder: {
    name: "toolNames",
    description: "Space-separated tool names to disable",
    required: true,
  },
} as const satisfies AgentCommandInputSchema;

function execute({ remainder, agent }: AgentCommandInputType<typeof inputSchema>): string {
  const toolNames = remainder.split(/\s+/).filter(Boolean);
  if (!toolNames.length) throw new CommandFailedError("Tool names required. Usage: /tools disable <tool1> <tool2> ...");
  const chatService = agent.requireServiceByType(ChatService);
  chatService.disableTools(
    toolNames.flatMap(n => chatService.ensureToolNamesLike(n)),
    agent,
  );
  return `Enabled tools: ${joinDefault(", ", chatService.getEnabledTools(agent), "(none)")}`;
}

export default {
  name: "tools disable",
  description: "Disable tools",
  aliases: ["tool disable"],
  inputSchema,
  execute,
  help: `Disable one or more tools by name.

## Example

/tools disable calculator
/tools disable web-search calculator`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
