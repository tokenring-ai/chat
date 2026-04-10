import type {TreeLeaf} from "@tokenring-ai/agent/question";
import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand,} from "@tokenring-ai/agent/types";
import joinDefault from "@tokenring-ai/utility/string/joinDefault";
import ChatService from "../../ChatService.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

async function execute({
                         agent,
                       }: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const chatService = agent.requireServiceByType(ChatService);
  const enabledTools = chatService.getEnabledTools(agent);
  const toolsByCategory: Record<
    string,
    Array<{ displayName: string; toolName: string }>
  > = {};
  for (const [toolName, tool] of chatService.getAvailableToolEntries()) {
    const [, category, displayName] = tool.toolDefinition?.displayName.match(
      /^(.*)\/(.*)/,
    ) ?? [null, "Unknown", tool.toolDefinition?.displayName ?? toolName];
    (toolsByCategory[category] ??= []).push({displayName, toolName});
  }
  const tree: TreeLeaf[] = Object.keys(toolsByCategory)
    .sort()
    .map((category) => ({
      name: `${category}`,
      children: toolsByCategory[category].map((t) => ({
        name: `${t.displayName}`,
        value: t.toolName,
      })),
    }));
  const selection = await agent.askQuestion({
    message: "Choose the tools to enable for this agent:",
    question: {
      type: "treeSelect",
      label: "Tool Selection",
      key: "result",
      defaultValue: enabledTools,
      minimumSelections: 0,
      tree,
    },
  });
  if (selection) {
    chatService.setEnabledTools(selection, agent);
    return `Enabled tools: ${joinDefault(", ", chatService.getEnabledTools(agent), "No tools selected.")}`;
  }
  return "Tool selection cancelled. No changes made.";
}

export default {
  name: "tools select",
  description: "Interactively select tools",
  aliases: ["tool select"],
  inputSchema,
  execute,
  help: `Open an interactive tree-based selector to choose which tools to enable. Tools are grouped by package.

## Example

/tools select`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
