import {Agent} from "@tokenring-ai/agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import type {InputAttachment} from "@tokenring-ai/agent/AgentEvents";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import ChatService from "../../ChatService.ts";
import runChat from "../../runChat.ts";
import {getChatAnalytics} from "../../util/getChatAnalytics.ts";

const description = "Send messages to the LLM";


async function execute({ input, attachments } : { input: string, attachments: InputAttachment[] }, agent: Agent): Promise<string> {
  if (!input) {
    throw new CommandFailedError("Please enter a message to send to AI, or type /help chat for available commands.");
  }
  const chatService = agent.requireServiceByType(ChatService);

  const chatConfig = chatService.getChatConfig(agent);

  const response = await runChat({input, attachments, chatConfig, agent});

  return `Chat Complete\n${getChatAnalytics(response)}`;
}


const help: string = `
## /chat send <message>

Send a message to the AI chat service. This is the primary command for communicating with the AI, using your selected model and current context.

### Examples

/chat send Hello, how are you?          # Send a simple message

### Features

- Uses your selected AI model (see \`/model\`)
- Includes conversation context and system prompts
- Provides available tools if enabled (see \`/tools\`)
- Shows detailed token usage analytics after completion
`.trim();


export default {
  name: "chat send",
  description,
  execute,
  help,
  allowAttachments: true,
} satisfies TokenRingAgentCommand;