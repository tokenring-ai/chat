import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import joinDefault from "@tokenring-ai/utility/string/joinDefault";
import ChatService from "../../ChatService.ts";

const inputSchema = {
  args: {},
  positionals: [{
    name: "toolNames",
    description: "Space-separated tool names to disable",
    required: true,
    greedy: true,
  }],
  allowAttachments: false,
} as const satisfies AgentCommandInputSchema;

async function execute({positionals, agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const toolNames = positionals.toolNames.split(/\s+/).filter(Boolean);
  if (!toolNames.length) throw new CommandFailedError("Tool names required. Usage: /tools disable <tool1> <tool2> ...");
  const chatService = agent.requireServiceByType(ChatService);
  chatService.disableTools(toolNames.map(n => chatService.ensureToolNamesLike(n)).flat(), agent);
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
