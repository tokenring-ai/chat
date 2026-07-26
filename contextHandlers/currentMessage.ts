import { mimeTypeClassifications } from "@tokenring-ai/agent/AgentEvents";
import type { ChatInputMessage } from "@tokenring-ai/ai-client/client/AIChatClient";
import type { FilePart, TextPart, UserModelMessage } from "@tokenring-ai/ai-client/schema.server";
import type { ContextHandlerOptions } from "../schema.ts";
import { ChatServiceState } from "../state/chatServiceState.ts";
import { decodeAttachmentAsBase64, decodeAttachmentAsText } from "../util/decodeAttachment.ts";

type RestrictiveFilePart = FilePart & { data: { type: "url" | "data" } };

export default async function* getContextItems({ input, attachments, chatConfig, agent }: ContextHandlerOptions): AsyncGenerator<ChatInputMessage> {
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
    ] as Array<TextPart | RestrictiveFilePart>,
  } satisfies UserModelMessage;

  for (const attachment of attachments ?? []) {
    const mimeTypeClassification = mimeTypeClassifications.get(attachment.mimeType);

    switch (mimeTypeClassification) {
      case undefined:
        agent.infoMessage(`Skipping attachment with unsupported mime type: ${attachment.mimeType}`);
        break;
      case "text": {
        const text = await decodeAttachmentAsText(attachment.body, attachment.encoding, chatConfig);
        result.content.push({
          type: "text",
          text: `BEGIN FILE ATTACHMENT: ${attachment.name}\n${text}\nEND FILE ATTACHMENT`,
        });
        break;
      }
      case "image":
      case "audio":
      case "video": {
        const contents = await decodeAttachmentAsBase64(attachment.body, attachment.encoding, chatConfig);
        result.content.push({
          type: "file",
          mediaType: attachment.mimeType,
          data: {
            type: "data",
            data: contents,
          },
        });
        break;
      }
      default: {
        const exhaustive: any = mimeTypeClassification satisfies never;
        throw new Error(`Unsupported attachment mime type: ${exhaustive}`);
      }
    }
  }

  yield result;
}
