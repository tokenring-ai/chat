import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand,} from "@tokenring-ai/agent/types";
import ChatService from "../../ChatService.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

function execute({
                   agent,
                 }: AgentCommandInputType<typeof inputSchema>): string {
  agent.requireServiceByType(ChatService).clearChatMessages(agent);
  return `Chat context reset`;
}

export default {
  name: "chat reset",
  description: "Reset the chat context",
  inputSchema,
  execute,
  help: `Reset the chat context, clearing prior messages and starting a new conversation.

## Example

/chat reset`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
