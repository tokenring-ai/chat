import type Agent from "@tokenring-ai/agent/Agent";
import { z } from "zod";
import ChatService from "../ChatService.ts";
import type { TokenRingToolDefinition, TokenRingToolResult } from "../schema.ts";

const name = "tools_list";
const displayName = "Chat/List Tools";

function execute(_: z.output<typeof inputSchema>, agent: Agent): TokenRingToolResult {
  const chatService = agent.requireService(ChatService);
  const enabledTools = chatService.getEnabledTools(agent);

  const tools = chatService.getAvailableToolEntries();

  const toolList = tools.filter(([name]) => !enabledTools.includes(name)).map(([name, tool]) => `- \`${name}\` - ${tool.toolDefinition?.displayName ?? name}`);

  return {
    message: `**Tools** Retrieved list of ${toolList.length} tools`,
    result: `The following tools are inactive, and can be enabled with the enable_tool tool call:\n${toolList.join("\n")}`,
  };
}

const inputSchema = z.object({});

const description = "Retrieves a list of currently inactivate tools that can be enabled using the enable_tool tool with the permission of the user.";

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
