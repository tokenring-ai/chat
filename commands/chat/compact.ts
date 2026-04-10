import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand,} from "@tokenring-ai/agent/types";
import ChatService from "../../ChatService.ts";

const description =
  "Compact conversation context by summarizing prior messages";

const inputSchema = {
  args: {},
  remainder: {name: "focus", description: "Optional focus for compaction"},
} as const satisfies AgentCommandInputSchema;

async function execute({
                         remainder,
                         agent,
                       }: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const chatService = agent.requireServiceByType(ChatService);
  const chatConfig = chatService.getChatConfig(agent);

  try {
    await chatService.compactContext(
      {
        ...chatConfig.compaction,
        focus: remainder ?? chatConfig.compaction.focus,
      },
      agent,
    );
    return "Context compacted successfully.";
  } catch (error) {
    throw new CommandFailedError(
      `Failed to compact context: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

const help: string = `Compress the conversation context by creating intelligent summaries of prior messages. This helps reduce token usage and maintain context in long conversations.

## How it works

- Analyzes all previous messages in the conversation
- Creates concise summaries while preserving key information
- Maintains conversation flow and important context
- Reduces token count for better performance and cost savings

## When to use

- After many messages have been exchanged
- When you notice responses getting slower
- When approaching token limits
- Before starting a new topic in a long conversation

## Benefits

- Faster response times in long conversations
- Lower API costs due to reduced token usage
- Maintains important context without losing information
- Prevents context overflow errors

## Example

/chat compact
/chat compact specifics of the task at hand, including the goal and expected outcome`;

export default {
  name: "chat compact",
  description,
  inputSchema,
  execute,
  help,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
