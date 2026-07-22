import type { BaseAttachment } from "@tokenring-ai/agent/AgentEvents";
import type { MaybePromise } from "bun";
import type { ChatServiceState } from "../state/chatServiceState.ts";

export function decodeAttachmentAsText(body: string, encoding: BaseAttachment["encoding"], chatState: ChatServiceState): MaybePromise<string> {
  switch (encoding) {
    case "text":
      return body;
    case "base64":
      return Buffer.from(body, "base64").toString("utf-8");
    case "href":
      if (!chatState.currentConfig.allowRemoteAttachments) throw new Error("Remote attachments are not allowed");

      return fetch(body).then(res => res.text());
    default: {
      const exhaustive: any = encoding satisfies never;
      throw new Error(`Unsupported encoding: ${exhaustive}`);
    }
  }
}
