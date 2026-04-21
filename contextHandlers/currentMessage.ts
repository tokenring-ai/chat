import type { ChatInputMessage } from "@tokenring-ai/ai-client/client/AIChatClient";
import type { FilePart, ImagePart, TextPart, UserModelMessage } from "@tokenring-ai/ai-client/schema";
import z from "zod";
import type { ContextHandlerOptions } from "../schema.ts";
import { ChatServiceState } from "../state/chatServiceState.ts";

//TODO: we should evaluate whether this should default to true or false
const sourceConfigSchema = z
  .object({
    allowRemoteAttachments: z.boolean().default(true),
  })
  .prefault({});

export default async function* getContextItems({ input, attachments, sourceConfig, agent }: ContextHandlerOptions): AsyncGenerator<ChatInputMessage> {
  const { allowRemoteAttachments } = sourceConfigSchema.parse(sourceConfig);
  const { injectedMessages } = agent.getState(ChatServiceState);
  for (const message of injectedMessages) {
    yield {
      role: "user",
      content: message,
    };
  }

  const result = {
    role: "user",
    content: [
      {
        type: "text",
        text: input,
      },
    ] as Array<TextPart | ImagePart | FilePart>,
  } satisfies UserModelMessage;

  for (const attachment of attachments ?? []) {
    if (attachment.mimeType.startsWith("text/")) {
      let text = attachment.body;
      switch (attachment.encoding) {
        case "text":
          break;
        case "base64":
          text = Buffer.from(attachment.body, "base64").toString("utf-8");
          break;
        case "href":
          if (!allowRemoteAttachments) throw new Error("Remote attachments are not allowed");
          text = await fetch(attachment.body).then(res => res.text());
          break;
        default: {
          // noinspection JSUnusedLocalSymbols
          const unknownEncoding: never = attachment.encoding;
          throw new Error(`Unsupported attachment encoding: ${unknownEncoding as string}`);
        }
      }

      text = `
--- The user has attached the following file ---
File Name: ${attachment.name}
File Type: ${attachment.mimeType}

${text}`.trim();

      result.content.push({
        type: "text",
        text,
      });
    } else if (attachment.mimeType.startsWith("image/")) {
      switch (attachment.encoding) {
        case "text":
          throw new Error("Image attachments cannot be text, only base64 or href");
        case "href":
          if (!allowRemoteAttachments) throw new Error("Remote attachments are not allowed");

          result.content.push({
            type: "image",
            mediaType: attachment.mimeType,
            image: new URL(attachment.body),
          });
          break;
        case "base64":
          result.content.push({
            type: "image",
            mediaType: attachment.mimeType,
            image: attachment.body,
          });
          break;
        default: {
          const unknownEncoding: never = attachment.encoding;
          throw new Error(`Unsupported attachment encoding: ${unknownEncoding as string}`);
        }
      }
    } else {
      switch (attachment.encoding) {
        case "text":
          result.content.push({
            type: "file",
            mediaType: attachment.mimeType,
            data: Buffer.from(attachment.body, "utf-8"),
          });
          break;
        case "href":
          if (!allowRemoteAttachments) throw new Error("Remote attachments are not allowed");

          result.content.push({
            type: "file",
            mediaType: attachment.mimeType,
            data: new URL(attachment.body),
          });
          break;
        case "base64":
          result.content.push({
            type: "file",
            mediaType: attachment.mimeType,
            data: attachment.body,
          });
          break;
        default: {
          // noinspection JSUnusedLocalSymbols
          const unknownEncoding: never = attachment.encoding;
          throw new Error(`Unsupported attachment encoding: ${unknownEncoding as string}`);
        }
      }
    }
  }

  yield result;
}
