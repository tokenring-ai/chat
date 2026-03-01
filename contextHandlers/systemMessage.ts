import type Agent from "@tokenring-ai/agent/Agent";
import {ChatInputMessage} from "@tokenring-ai/ai-client/client/AIChatClient";
import {type ContextHandlerOptions, ParsedChatConfig} from "../schema.ts";

export default async function* getContextItems({chatConfig}: ContextHandlerOptions): AsyncGenerator<ChatInputMessage> {
  if (typeof chatConfig.systemPrompt === 'function') {
    yield {role: "system", content: chatConfig.systemPrompt()};
  } else {
    yield {role: "system", content: chatConfig.systemPrompt};
  }
}