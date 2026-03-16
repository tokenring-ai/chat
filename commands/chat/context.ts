import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import ChatService from "../../ChatService.ts";

const description = "Show the current context for the chat session";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

async function execute({agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  try {
    const chatService = agent.requireServiceByType(ChatService);
    const chatConfig = chatService.getChatConfig(agent);

    const messages = await chatService.buildChatMessages({input: "input", chatConfig, agent});

    const lines: string[] = [
      "Context items that would be added to chat request:",
      `Total messages: ${messages.length}`
    ];

    messages.slice(0, -1).forEach((msg, index) => {
      const content =
        typeof msg.content === "string"
          ? msg.content
            ? Array.isArray(msg.content)
              ? msg.content[0].text
              : msg.content
            : msg.content
          : JSON.stringify(msg.content);
      const preview =
        content.length > 100 ? content.substring(0, 130) + "..." : content;
      lines.push(`${index + 1}. [${msg.role}] ${preview}`);
    });

    return lines.join("\n");
  } catch (error) {
    throw new CommandFailedError(`Error building context: ${error}`);
  }
}

const help: string = `
## /chat context

Display all context items that would be included in a chat request. Useful for debugging and understanding what information the AI has access to.

### Shows

- Total number of context messages
- System prompt configuration
- Previous conversation messages (with preview)

**Note:** Context display shows the exact data sent to the AI model.`.trim();

export default {
  name: "chat context",
  description,
  inputSchema,
  execute,
  help,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
