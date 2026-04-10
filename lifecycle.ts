import type {AIResponse} from "@tokenring-ai/ai-client/client/AIChatClient";

export class AfterChatCompletion {
  readonly type = "hook";

  constructor(readonly response: AIResponse) {
  }
}

export class AfterChatClear {
  readonly type = "hook";
}

export class AfterChatCompaction {
  readonly type = "hook";
}
