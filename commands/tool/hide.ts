import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import joinDefault from "@tokenring-ai/utility/string/joinDefault";
import ChatService from "../../ChatService.ts";

const inputSchema = {
  args: {},
  remainder: {name: "toolNames", description: "Space-separated tool names to hide", required: true}
} as const satisfies AgentCommandInputSchema;

async function execute({remainder, agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const toolNames = remainder.split(/\s+/).filter(Boolean);
  if (!toolNames.length) throw new CommandFailedError("Tool names required. Usage: /tools hide <tool1> <tool2> ...");
  const chatService = agent.requireServiceByType(ChatService);
  chatService.hideTools(toolNames.map(n => chatService.ensureToolNamesLike(n)).flat(), agent);
  return `Hidden tools: ${joinDefault(", ", chatService.getHiddenTools(agent), "(none)")}`;
}

export default {
  name: "tools hide",
  description: "Hide tools",
  aliases: ["tool hide"],
  inputSchema,
  execute,
  help: `Hide one or more tools by name, requiring the model to search for the tool to activate it before use.

Saves context in some cases; useful for agents that need access to large numbers of tools.

## Example

/tools hide calculator
/tools hide web-search calculator`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
