import Agent from "@tokenring-ai/agent/Agent";
import type {TreeLeaf} from "@tokenring-ai/agent/question";
import joinDefault from "@tokenring-ai/utility/string/joinDefault";
import ChatService from "../../ChatService.ts";

export default async function select(_remainder: string, agent: Agent): Promise<void> {
  const chatService = agent.requireServiceByType(ChatService);
  const enabledTools = chatService.getEnabledTools(agent);
  const availableTools = chatService.getAvailableTools();

  const toolsByCategory: Record<string, Array<{ displayName: string, toolName: string }>> = {};

  for (const [toolName, tool] of Object.entries(availableTools)) {
    let [, category, displayName] = tool.toolDefinition?.displayName.match(/^(.*)\/(.*)/) ?? [null, "Unknown", tool.toolDefinition?.displayName ?? toolName];
    (toolsByCategory[category] ??= []).push({ displayName, toolName });
  }

  const buildToolTree = (): TreeLeaf[] => {
    const tree: TreeLeaf[] = [];
    const sortedCategories = Object.keys(toolsByCategory).sort((a, b) => a.localeCompare(b));

    for (const category of sortedCategories) {
      const tools = toolsByCategory[category];
      const children = tools.map((tool) => ({
        name: `🔧 ${tool.displayName}`,
        value: tool.toolName,
      }));

      tree.push({
        name: `📦 ${category}`,
        value: `${category}/*`,
        children,
      });
    }

    return tree;
  };

  const selection = await agent.askQuestion({
    message: "Choose the tools to enable for this agent:",
    question: {
      type: 'treeSelect',
      label: "Tool Selection",
      key: "result",
      defaultValue: enabledTools,
      minimumSelections: 0,
      tree: buildToolTree(),
    }
  });

  if (selection) {
    chatService.setEnabledTools(selection, agent);
    agent.infoMessage(
      `Enabled tools: ${joinDefault(", ", chatService.getEnabledTools(agent), "No tools selected.")}`,
    );
  } else {
    agent.infoMessage("Tool selection cancelled. No changes made.");
  }
}
