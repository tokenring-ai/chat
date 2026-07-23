import type { ChatInputMessage } from "@tokenring-ai/ai-client/client/AIChatClient";
import type { FilePart, TextPart, UserModelMessage } from "@tokenring-ai/ai-client/schema.server";
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
    ] as Array<TextPart | FilePart>,
  } satisfies UserModelMessage;

  for (const attachment of attachments ?? []) {
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
        const exhaustive: any = attachment.encoding satisfies never;
        throw new Error(`Unsupported attachment encoding: ${exhaustive}`);
      }
    }
  }

  yield result;
}
