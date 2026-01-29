import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import createSubcommandRouter from "@tokenring-ai/agent/util/subcommandRouter";
import defaultAction from "./tool/default.ts";
import disable from "./tool/disable.ts";
import enable from "./tool/enable.ts";
import list from "./tool/list.ts";
import select from "./tool/select.ts";
import set from "./tool/set.ts";

const description = "/tools - List, enable, disable, or set enabled tools for the chat session.";

const execute = createSubcommandRouter({
  list,
  enable,
  disable,
  set,
  select,
  default: defaultAction
});

const help: string = `# /tools <list|enable|disable|set|select>

Manage available tools for your chat session. Tools provide additional capabilities like web search, code execution, file operations, etc.

## Usage

/tools                    # Show tools and open selector (unless headless)
/tools list               # List enabled tools
/tools enable <tool1> ... # Enable specific tools
/tools disable <tool1> ...# Disable specific tools
/tools set <tool1> ...    # Set exactly which tools are enabled
/tools select             # Interactive tool selection

## Examples

/tools                    # Browse and select tools interactively
/tools list               # Show currently enabled tools
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