import type { ChatInputMessage } from "@tokenring-ai/ai-client/client/AIChatClient";
import z from "zod";
import { ChatService } from "../index.ts";
import type { ContextHandlerOptions } from "../schema.ts";
import { buildUserMessageWithAttachments } from "../util/buildUserMessageWithAttachments.ts";

const toolCallParamsSchema = z.object({
  header: z.string(),
  toolName: z.string(),
  toolInput: z.record(z.string(), z.any()),
});

export default async function* getContextItems({ sourceConfig, chatConfig, agent }: ContextHandlerOptions): AsyncGenerator<ChatInputMessage> {
  const validatedParams = toolCallParamsSchema.parse(sourceConfig.params);

  const chatService = agent.requireService(ChatService);
  const { toolDefinition } = chatService.requireTool(validatedParams.toolName);

  if (!toolDefinition) throw new Error(`Tool ${validatedParams.toolName} is not a native TokenRing tool, and cannot be injected into the chat context.`);

  const { inputSchema, execute } = toolDefinition;

  const result = await execute(inputSchema.parse(validatedParams.toolInput), agent);

  yield buildUserMessageWithAttachments(`${validatedParams.header}\n\n${result.result}`, result.attachments, agent, chatConfig);
}
