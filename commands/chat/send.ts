import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand, TokenRingAgentCommandResult } from "@tokenring-ai/agent/types";
import ChatService from "../../ChatService.ts";
import runChat from "../../runChat.ts";
import { getChatAnalytics } from "../../util/getChatAnalytics.ts";

const description = "Send messages to the LLM";

const inputSchema = {
  args: {},
  remainder: {
    name: "message",
    description: "The message to send",
    required: true,
  },
  allowAttachments: true,
} as const satisfies AgentCommandInputSchema;

async function execute({ remainder, attachments, agent }: AgentCommandInputType<typeof inputSchema>): Promise<TokenRingAgentCommandResult> {
  const chatService = agent.requireServiceByType(ChatService);
  const chatConfig = chatService.getChatConfig(agent);
  const response = await runChat({
    input: remainder,
    attachments,
    chatConfig,
    agent,
  });

  const { totalTokens, inputTokens, outputTokens } = response.lastStepUsage;

  return {
    message: `Response Complete (Tokens: ${totalTokens?.toLocaleString() ?? "Unknown"} ↑${inputTokens?.toLocaleString() ?? "Unknown"} ↓${outputTokens?.toLocaleString() ?? "Unknown"})`,
    details: getChatAnalytics(response),
  };
}

const help: string = `Send a message to the AI chat service. This is the primary command for communicating with the AI, using your selected model and current context.

## Example

/chat send Hello, how are you?`;

export default {
  name: "chat send",
  description,
  inputSchema,
  execute,
  help,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
