import Agent from "@tokenring-ai/agent/Agent";
import type {TreeLeaf} from "@tokenring-ai/agent/question";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import joinDefault from "@tokenring-ai/utility/string/joinDefault";
import ChatService from "../ChatService.ts";

/**
 * Usage:
 *   /tools [enable|disable|set] <tool1> <tool2> ...
 *   /tools                 - shows interactive tool selection
 *   /tools enable foo bar  - enables foo and bar
 *   /tools disable baz     - disables baz
 *   /tools set a b c       - sets enabled tools to a, b, c
 */

const description =
  "/tools - List, enable, disable, or set enabled tools for the chat session." as const;

async function execute(
  remainder: string,
  agent: Agent,
): Promise<void> {
  const chatService = agent.requireServiceByType(ChatService);
  const enabledTools = chatService.getEnabledTools(agent);

  const availableTools = chatService.getAvailableTools();

  // Handle direct tool operations, e.g. /tools enable foo bar
  const directOperation = remainder?.trim();
  if (directOperation) {
    const parts = directOperation.split(/\s+/);
    const operation = parts[0];
    const toolNames = parts.slice(1);

    if (!["enable", "disable", "set"].includes(operation)) {
      agent.errorMessage(
        "Unknown operation. Usage: /tools [enable|disable|set] <tool1> <tool2> ...",
      );
      return;
    }

    const matchedToolNames = toolNames.map(toolName => chatService.ensureToolNamesLike(toolName)).flat();

    switch (operation) {
      case "enable": {
        chatService.enableTools(matchedToolNames, agent);
        break;
      }
      case "disable": {
        chatService.disableTools(matchedToolNames, agent);
        break;
      }
      case "set": {
        chatService.setEnabledTools(matchedToolNames, agent);
        break;
      }
    }

    agent.infoMessage(
      `Enabled tools: ${joinDefault(
        ", ",
        chatService.getEnabledTools(agent),
        "(none)",
      )}`,
    );
    return;
  }

  const toolsByCategory: Record<string, Array<{ displayName: string, toolName: string }>> = {};

  for (const [toolName, tool] of Object.entries(availableTools)) {
    let [, category, displayName] = tool.toolDefinition?.displayName.match(/^(.*)\/(.*)/) ?? [null, "Unknown", tool.toolDefinition?.displayName ?? toolName];

    (toolsByCategory[category] ??= []).push({ displayName, toolName });
  }

  // Build tree structure for tool selection
  const buildToolTree = () : TreeLeaf[] => {
    const tree: TreeLeaf[] = []
    const sortedCategories = Object.keys(toolsByCategory).sort((a, b) =>
      a.localeCompare(b),
    );

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

  try {
    const selection = await agent.askQuestion({
      message: `Choose the tools to enable for this agent:`,
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
        `Enabled tools: ${joinDefault(
          ", ",
          chatService.getEnabledTools(agent),
          "No tools selected.",
        )}`,
      );
    } else {
      agent.infoMessage("Tool selection cancelled. No changes made.");
    }
  } catch (error) {
    agent.errorMessage(`Error during tool selection:`, error as Error);
  }
}

const help: string = `# /tools [enable|disable|set] <tool1> <tool2> ...

Manage available tools for your chat session. Tools provide additional capabilities like web search, code execution, file operations, etc.

## Modes

- \`/tools\` - Interactive tool selection (recommended)
- \`/tools enable tool1 tool2\` - Enable specific tools
- \`/tools disable tool1\` - Disable specific tools
- \`/tools set tool1 tool2\` - Set exactly which tools are enabled

## Examples

/tools                    # Browse and select tools interactively
/tools enable web-search  # Enable web search tool
/tools disable calculator # Disable calculator tool
/tools set web-search calculator # Only enable these two tools

## Interactive Mode

- Tools are grouped by package for easy browsing
- Current selection is shown with checkmarks
- Use spacebar to toggle selection, enter to confirm

**Note:** Some tools may require additional setup or permissions.`;
export default {
  description,
  execute,
  help,
} satisfies TokenRingAgentCommand;