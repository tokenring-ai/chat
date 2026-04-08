import {ChatInputMessage} from "@tokenring-ai/ai-client/client/AIChatClient";
import interpolateString from "@tokenring-ai/utility/string/interpolateString";
import {type ContextHandlerOptions} from "../schema.ts";

const replacementFunctions = {
  DATE: () => new Date().toLocaleDateString(),
} as Record<string, () => string>;

export default async function* getContextItems({chatConfig}: ContextHandlerOptions): AsyncGenerator<ChatInputMessage> {
  yield {role: "system", content: interpolateString(chatConfig.systemPrompt, replacementFunctions)};
}