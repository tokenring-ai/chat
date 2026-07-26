import type { BaseAttachment } from "@tokenring-ai/agent/AgentEvents";
import type { MaybePromise } from "bun";
import type { ParsedChatConfig } from "../schema.ts";

export function decodeAttachmentAsText(body: string, encoding: BaseAttachment["encoding"], chatConfig: ParsedChatConfig): MaybePromise<string> {
  switch (encoding) {
    case "text":
      return body;
    case "base64":
      return Buffer.from(body, "base64").toString("utf-8");
    case "href":
      if (!chatConfig.allowRemoteAttachments) throw new Error("Remote attachments are not allowed");

      return fetch(body).then(res => res.text());
    default: {
      const exhaustive: any = encoding satisfies never;
      throw new Error(`Unsupported encoding: ${exhaustive}`);
    }
  }
}

export function decodeAttachmentAsBase64(body: string, encoding: BaseAttachment["encoding"], chatConfig: ParsedChatConfig): MaybePromise<string> {
  switch (encoding) {
    case "text":
      return new TextEncoder().encode(body).toBase64();
    case "base64":
      return body;
    case "href":
      if (!chatConfig.allowRemoteAttachments) throw new Error("Remote attachments are not allowed");

      return fetch(body)
        .then(res => res.arrayBuffer())
        .then(buf => Buffer.from(buf).toString("base64"));
    default: {
      const exhaustive: any = encoding satisfies never;
      throw new Error(`Unsupported encoding: ${exhaustive}`);
    }
  }
}
