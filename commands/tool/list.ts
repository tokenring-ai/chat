import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import joinDefault from "@tokenring-ai/utility/string/joinDefault";
import ChatService from "../../ChatService.ts";

export default {
  name: "tool list",
  description: "/tool list - List enabled tools",
  help: `# /tools list

List all currently enabled tools.

## Example

/tools list`,
  execute: async (_remainder: string, agent: Agent): Promise<string> =>
    `Enabled tools: ${joinDefault(", ", agent.requireServiceByType(ChatService).getEnabledTools(agent), "(none)")}`,
} satisfies TokenRingAgentCommand;
