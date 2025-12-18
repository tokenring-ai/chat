import Agent from "@tokenring-ai/agent/Agent";
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
  remainder: string | undefined,
  agent: Agent,
): Promise<void> {
  const chatService = agent.requireServiceByType(ChatService);
  const enabledTools = chatService.getEnabledTools(agent);

  const availableTools = chatService.getAvailableToolNames();

  // Handle direct tool operations, e.g. /tools enable foo bar
  const directOperation = remainder?.trim();
  if (directOperation) {
    const parts = directOperation.split(/\s+/);
    const operation = parts[0];
    const toolNames = parts.slice(1);

    if (!["enable", "disable", "set"].includes(operation)) {
      agent.errorLine(
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

    agent.infoLine(
      `Enabled tools: ${joinDefault(
        ", ",
        chatService.getEnabledTools(agent),
        "(none)",
      )}`,
    );
    return;
  }

  const toolsByPackage: Record<string, string[]> = {};

  for (const toolName of availableTools) {
    let [, packageName] = toolName.match(/^(.*)\//) ?? [null, "un"];

    if (!toolsByPackage[packageName]) {
      toolsByPackage[packageName] = [];
    }
    toolsByPackage[packageName].push(toolName);
  }

  for (const packageName in toolsByPackage) {
    toolsByPackage[packageName].sort((a, b) => a.localeCompare(b));
  }

  // Build tree structure for tool selection
  const buildToolTree = () => {
    const tree: any = {
      name: "Tool Selection",
      children: [],
    };
    const sortedPackages = Object.keys(toolsByPackage).sort((a, b) =>
      a.localeCompare(b),
    );

    for (const packageName of sortedPackages) {
      const tools = toolsByPackage[packageName];
      const children = tools.map((toolName) => ({
        name: `🔧 ${toolName}`,
        value: toolName,
      }));

      tree.children.push({
        name: `📦 ${packageName}`,
        value: `${packageName}/*`,
        hasChildren: true,
        children,
      });
    }

    return tree;
  };

  // Interactive tree selection if no operation is provided in the command
  try {
    const selectedTools = await agent.askHuman({
      type: "askForMultipleTreeSelection",
      title: "Tool Selection",
      message: `Choose the tools to enable for this agent:`,
      tree: buildToolTree(),
      initialSelection: enabledTools,
    });

    if (selectedTools) {
      chatService.setEnabledTools(selectedTools, agent);
      agent.infoLine(
        `Enabled tools: ${joinDefault(
          ", ",
          chatService.getEnabledTools(agent),
          "No tools selected.",
        )}`,
      );
    } else {
      agent.infoLine("Tool selection cancelled. No changes made.");
    }
  } catch (error) {
    agent.errorLine(`Error during tool selection:`, error as Error);
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
} as TokenRingAgentCommand;