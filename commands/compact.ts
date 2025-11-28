import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import {compactContext} from "../util/compactContext.ts";

const description =
  "/compact - Compact conversation context by summarizing prior messages";

async function execute(remainder: string, agent: Agent): Promise<void> {
  agent.systemMessage("Compacting context...");
  await compactContext(agent);
}

const help: string = `# /compact

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

# After 50+ messages in a conversation
/compact                    # Compresses all prior messages

**Note:** Compaction is automatic in some cases, but manual compaction gives you control over when and how context is compressed.`;
export default {
  description,
  execute,
  help,
} as TokenRingAgentCommand;