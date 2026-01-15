import type Agent from "@tokenring-ai/agent/Agent";
import {ChatInputMessage} from "@tokenring-ai/ai-client/client/AIChatClient";
import {ParsedChatConfig} from "../schema.ts";

export default async function* getContextItems(input: string, chatConfig: ParsedChatConfig, params: {}, agent: Agent): AsyncGenerator<ChatInputMessage> {
  if (typeof chatConfig.systemPrompt === 'function') {
    yield {role: "system", content: chatConfig.systemPrompt()};
  } else {
    yield {role: "system", content: chatConfig.systemPrompt};
  }
}