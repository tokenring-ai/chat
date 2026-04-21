import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import joinDefault from "@tokenring-ai/utility/string/joinDefault";
import ChatService from "../../ChatService.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

function execute({ agent }: AgentCommandInputType<typeof inputSchema>): string {
  return `Enabled tools: ${joinDefault(", ", agent.requireServiceByType(ChatService).getEnabledTools(agent), "(none)")}`;
}

export default {
  name: "tool list",
  description: "List enabled tools",
  aliases: ["tools list"],
  inputSchema,
  execute,
  help: `List all currently enabled tools.

## Example

/tools list`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
