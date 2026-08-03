import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import ChatService from "../ChatService.ts";
import type { ParsedChatConfig, ToolApprovalMode } from "../schema.ts";

const inputSchema = {
  args: {
    level: {
      type: "number",
      description: "Auto-approval level (0–10). Tool actions at or below this level are approved automatically.",
      required: false,
      minimum: 0,
      maximum: 10,
    },
    mode: {
      type: "enum",
      description: "How to handle actions above the auto-approval level: ask, reject, or auto",
      values: ["ask", "reject", "auto"],
      required: false,
    },
  },
} as const satisfies AgentCommandInputSchema;

const help = `Show or set tool approval policy for this chat session.

## Settings

- \`--level 0-10\` — auto-approve tool actions at or below this safety level
- \`--mode ask|reject|auto\` — how to handle actions above that level:
  - \`ask\` — prompt the user (default)
  - \`reject\` — deny without prompting
  - \`auto\` — re-assess with the chat model, then auto-approve or ask

## Examples

\`\`\`
/approval
/approval --level 3
/approval --mode auto
/approval --level 5 --mode ask
/approval --mode reject
\`\`\``;

function formatStatus(config: ParsedChatConfig): string {
  return `Tool approval:\n` + `- Auto-approve level: **${config.autoToolApprovalLevel}**/10\n` + `- Mode (above that level): **${config.toolApprovalMode}**`;
}

function execute({ args, agent }: AgentCommandInputType<typeof inputSchema>): string {
  const chatService = agent.requireService(ChatService);
  const { level, mode } = args;

  if (level === undefined && mode === undefined) {
    return `${formatStatus(chatService.getChatConfig(agent))}\n\n${help}`;
  }

  const updates: Partial<ParsedChatConfig> = {};
  if (level !== undefined) {
    updates.autoToolApprovalLevel = level;
  }
  if (mode !== undefined) {
    updates.toolApprovalMode = mode as ToolApprovalMode;
  }

  chatService.updateChatConfig(updates, agent);
  return `Updated.\n${formatStatus(chatService.getChatConfig(agent))}`;
}

const command = {
  name: "approval",
  alias: ["approve"],
  description: "Show or set tool approval level and mode (ask, reject, auto)",
  inputSchema,
  execute,
  help,
} satisfies TokenRingAgentCommand<typeof inputSchema>;

export default command;
