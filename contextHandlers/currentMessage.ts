import type Agent from "@tokenring-ai/agent/Agent";
import {ChatInputMessage} from "@tokenring-ai/ai-client/client/AIChatClient";
import {ChatConfig} from "../types.ts";

export default async function * getContextItems(input: string, chatConfig: ChatConfig, params: {}, agent: Agent): AsyncGenerator<ChatInputMessage> {
  yield {role: "user", content: input};
}
