import { CommandFailedError } from "@tokenring-ai/agent/AgentError";
import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import indent from "@tokenring-ai/utility/string/indent";
import ChatService from "../../ChatService.ts";

const description = "Show the current context for the chat session";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

async function execute({ agent }: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  try {
    const chatService = agent.requireServiceByType(ChatService);
    const chatConfig = chatService.getChatConfig(agent);

    const { instructions, messages } = await chatService.buildChatMessages({
      input: "input",
      chatConfig,
      agent,
    });

    const lines: string[] = [
      "System Prompt:",
      instructions,
      `Messages: (${messages.length})`,

      ...messages.slice(0, -1).map((msg, index) => {
        let content: string;
        if (msg.content === "string") {
          content = msg.content;
        } else if (Array.isArray(msg.content)) {
          content = msg.content
            .map(c => {
              if (c.type === "text") {
                return `- [TextPart]:\n${indent(c.text, 2)}`;
              } else if (c.type === "image") {
                return `- [ImagePart]: ${c.mediaType} (${c.image.constructor.name})`;
              } else if (c.type === "file") {
                return `- [FilePart]: ${c.mediaType} (${c.data.constructor.name})`;
              } else if (c.type === "tool-call") {
                return `- [ToolCall]: ${c.toolCallId}`;
              } else if (c.type === "tool-result") {
                return `- [ToolResult]: ${c.toolCallId}`;
              } else if (c.type === "reasoning") {
                return `- [Reasoning]:\n${indent(c.text, 2)}`;
              } else {
                return `- [UnknownPart]: ${c.type}`;
              }
            })
            .join("\n");
        } else {
          content = JSON.stringify(msg.content);
        }

        const preview = content.length > 200 ? content.substring(0, 20) + `...[${200 - content.length} addl characters]` : content;
        return `${index + 1}. [${msg.role}] ${indent(preview, 2)}`;
      }),
    ];

    return lines.join("\n");
  } catch (err) {
    throw new CommandFailedError(`Error building context`, { cause: err });
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
