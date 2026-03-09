import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import ChatService from "../../ChatService.ts";

const description =
  "/chat compact - Compact conversation context by summarizing prior messages";

async function execute(remainder: string, agent: Agent): Promise<string> {
  const focus = remainder.trim() || null;
  const chatService = agent.requireServiceByType(ChatService);
  const chatConfig = chatService.getChatConfig(agent);

  try {
    await chatService.compactContext({
      ...chatConfig.compaction,
      focus: focus ?? chatConfig.compaction.focus,
    }, agent);
    return "Context compacted successfully.";
  } catch (error) {
    throw new CommandFailedError(`Failed to compact context: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const help: string = `# /chat compact [<focus>]

Compress the conversation context by creating intelligent summaries of prior messages. This helps reduce token usage and maintain context in long conversations.

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

# Compresses all prior messages
/chat compact                    

# Gives more control over context compression
/chat compact specifics of the task at hand, including the goal and expected outcome

**Note:** Compaction is automatic in some cases, but manual compaction gives you control over when and how context is compressed.`;
export default {
  name: "chat compact",
  description,
  execute,
  help,
} satisfies TokenRingAgentCommand;
