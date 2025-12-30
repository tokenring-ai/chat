import type Agent from "@tokenring-ai/agent/Agent";
import {ChatInputMessage} from "@tokenring-ai/ai-client/client/AIChatClient";
import z from "zod";
import ChatService from "../ChatService.ts";
import {ChatConfig} from "../schema.ts";

const priorMessagesParamsSchema = z.object({
  maxMessages: z.number().min(4).default(1000),
})

export default async function * getContextItems(input: string, chatConfig: ChatConfig, params: any, agent: Agent): AsyncGenerator<ChatInputMessage> {
  const safeParams = priorMessagesParamsSchema.parse(params);
  const chatService = agent.requireServiceByType(ChatService);
  const lastMessage = chatService.getLastMessage(agent);

  let messages = [
    ...lastMessage?.request.messages ?? [],
    ...lastMessage?.response.messages ?? [],
  ]

  if (messages.length > safeParams.maxMessages) {
    const messagesToRemove = messages.length - safeParams.maxMessages;

    const start = Math.max(2,(messages.length / 2) - (messagesToRemove / 2));

    const end = Math.min(messages.length - 2, start + messagesToRemove);

    messages = [
      ...messages.slice(0, start),
      { role: "user", content: "... this content was removed to shorten the chat context ..." },
      ...messages.slice(end),
    ];
  }

  for (const message of messages) {
    yield message;
  }
}