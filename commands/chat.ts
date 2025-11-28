import {Agent} from "@tokenring-ai/agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import type {ChatInputMessage} from "@tokenring-ai/ai-client/client/AIChatClient";
import runChat from "../runChat.ts";
import {outputChatAnalytics} from "../util/outputChatAnalytics.ts";

const description =
  "/chat - Send a message to the chat service";

async function execute(remainder: string, agent: Agent): Promise<void> {
  if (!remainder?.trim()) {
    agent.infoLine("Please enter a message to send to AI, or type /help for a list of the available commands.");
    return;
  }

  const currentInput: ChatInputMessage[] = [
    {role: "user", content: remainder},
  ];
  const [_output, response] = await runChat(
    {
      input: currentInput,
    },
    agent,
  );
  outputChatAnalytics(response, agent);
}

const help: string = `# /chat [message]

Send a message to the AI chat service. This is the primary command for communicating with the AI, using your selected model and current context.

## Usage

/chat Hello, how are you?      # Send a simple message
/chat Explain quantum computing # Ask for an explanation
/chat Write a poem about AI    # Request creative content

## Features

- Uses your selected AI model (see \`/model\`)
- Includes conversation context and system prompts
- Provides available tools if enabled (see \`/tools\`)
- Shows detailed token usage analytics after completion

## Context Included

- Previous conversation messages
- System prompts and configuration
- Enabled tools and their capabilities
- Any context items you've added

## Analytics Display

- Input and output token counts
- Total cost estimation
- Response time metrics
- Model and feature information

## Examples

/chat What's the weather today?     # Ask about current conditions
/chat Help me debug this code:      # Share code for assistance
/chat Summarize this article:      # Paste article content
/chat Generate a Python script:     # Request code generation

## Tips

- Be specific and detailed for better responses
- Use \`/tools\` to enable relevant capabilities first
- Check token usage in long conversations
- Use \`/compact\` if responses become slow

**Note:** For multi-line messages, you can type them directly or use your terminal's multi-line input capabilities.`;
export default {
  description,
  execute,
  help,
} as TokenRingAgentCommand;