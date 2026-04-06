import Agent from "@tokenring-ai/agent/Agent";
import {z} from "zod";
import ChatService from "../ChatService.ts";
import {TokenRingToolDefinition, type TokenRingToolResult} from "../schema.ts";
import {ChatServiceState} from "../state/chatServiceState.ts";

const name = "tool_search";
const displayName = "Chat/toolSearch";

async function execute(
  {regex}: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolResult> {
  const chatService = agent.requireServiceByType(ChatService);
  const chatConfig = chatService.getChatConfig(agent);
  const hiddenTools = chatConfig.hiddenTools ?? [];

  if (hiddenTools.length === 0) {
    return "No searchable tools are configured for this agent.";
  }

  let pattern: RegExp;
  try {
    pattern = new RegExp(regex, "i");
  } catch {
    throw new Error(`Invalid regex pattern: ${regex}`);
  }

  const matched: string[] = [];
  for (const toolName of hiddenTools) {
    const namedTool = chatService.requireTool(toolName);
    const searchText = [
      toolName,
      namedTool.toolDefinition?.displayName ?? "",
      namedTool.toolDefinition?.description ?? "",
    ].join(" ");

    if (pattern.test(searchText)) {
      matched.push(toolName);
    }
  }

  if (matched.length === 0) {
    return `No searchable tools matched the pattern /${regex}/`;
  }

  chatService.enableTools(matched, agent);

  return `Enabled tool(s): ${matched.join(", ")}, you may now use them.`;
}

function adjustActivation(enabled: boolean, agent: Agent) {
  const { hiddenTools} = agent.getState(ChatServiceState).currentConfig;
  return hiddenTools.length > 0;
}

const inputSchema = z.object({
  regex: z.string().describe(
    "Regex pattern (case-insensitive) to match against tool names and descriptions. Examples: \"weather\", \"file.*read\", \"database|sql\"",
  ),
});

const description = "Search for tools by regex pattern and enables matching tools. Searches tool names and descriptions.";

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
  adjustActivation
} satisfies TokenRingToolDefinition<typeof inputSchema>;
