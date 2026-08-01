import type Agent from "@tokenring-ai/agent/Agent";
import { z } from "zod";
import ChatService from "../ChatService.ts";
import type { TokenRingToolDefinition, TokenRingToolResult } from "../schema.ts";

const name = "enable_tools";
const displayName = "Chat/Enable Tools";

async function execute({ toolNames }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const chatService = agent.requireService(ChatService);
  if (
    !(await agent.askForApproval({
      message: `The agent has requested access to the following tools: ${toolNames.join(", ")}. Do you want to allow access?`,
    }))
  ) {
    return {
      failed: true,
      message: "**Tools** User denied access to tools",
      result: "The user denied access to the requested tools",
    };
  }

  chatService.enableTools(toolNames, agent);

  //TODO: the tools won't enable in the same agent loop, need to fix this in runChat.ts
  return {
    message: `**Tools** Enabled ${toolNames.length} tools`,
    result: `The following tools are now enabled: ${toolNames.join(", ")}`,
  };
}

const inputSchema = z.object({
  toolNames: z.array(z.string()).describe("The names of the tools to enable, as returned by list_tools"),
});

const description = "Enables the specified tools for the agent";

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
