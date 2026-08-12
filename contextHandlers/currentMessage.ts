import type { ChatInputMessage } from "@tokenring-ai/ai-client/client/AIChatClient";
import type { ContextHandlerOptions } from "../schema.ts";
import { ChatServiceState } from "../state/chatServiceState.ts";
import { buildUserMessageWithAttachments } from "../util/buildUserMessageWithAttachments.ts";

export default async function* getContextItems({ input, attachments, chatConfig, agent }: ContextHandlerOptions): AsyncGenerator<ChatInputMessage> {
  const { injectedMessages } = agent.getState(ChatServiceState);
  for (const message of injectedMessages) {
    yield {
      role: "user",
      content: message,
    };
  }
  yield await buildUserMessageWithAttachments(input, attachments, agent, chatConfig);
}
