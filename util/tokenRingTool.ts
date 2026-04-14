import type {Agent} from "@tokenring-ai/agent";
import type {BaseAttachment} from "@tokenring-ai/agent/AgentEvents";
import {chatTool} from "@tokenring-ai/ai-client";
import type {MaybePromise} from "bun";
import type {z} from "zod";
import type {TokenRingFullToolResult, TokenRingToolDefinition} from "../schema.ts";
import {ChatServiceState} from "../state/chatServiceState.ts";

//TODO: This is fucking stupid but less pain than the alternatives
export type ToolResultValue = {
  type: 'text';
  text: string;
} | {
  type: 'file-data';
  data: string;
  mediaType: string;
  filename?: string;
} | {
  type: 'file-url';
  url: string;
} | {
  type: 'image-data';
  data: string;
  mediaType: string;
} | {
  type: 'image-url';
  url: string;
};

export type ToolResultOutput = {
  type: 'content';
  value: Array<ToolResultValue>
};

//export type ToolResultOutput = Awaited<ReturnType<NonNullable<Parameters<typeof chatTool>["0"]["toModelOutput"]>>>

export function tokenRingTool(toolDefinition: TokenRingToolDefinition<any>) {
  const {name, displayName, description, inputSchema, execute} =
    toolDefinition;
  return {
    name,
    displayName,
    toolDefinition,
    tool: chatTool({
      description,
      inputSchema,
      async execute(
        args: z.output<typeof inputSchema>,
        {experimental_context}: Record<string, any>,
      ): Promise<ToolResultOutput> {
        const agent = experimental_context.agent as Agent;

        const executeToolFunction = async (): Promise<ToolResultOutput> => {
          let result: TokenRingFullToolResult
          try {
            const tmp = await execute(args, agent);

            if (typeof tmp === "string") {
              result = {
                summary: displayName,
                result: tmp
              };
            } else {
              result = {
                ...tmp,
                summary: tmp.summary || displayName,
              };
            }
          } catch (err: any) {
            agent.errorMessage(
              `Error calling tool ${name}(${JSON.stringify(args)}): ${err}`,
            );
            result = {
              summary: `${displayName} (Tool execution failed)`,
              result: `Error calling tool: ${err.message || err}. Please check your tool call for correctness and retry the function call.`
            };
          }

          agent.toolCallResult({
            name,
            args,
            ...result,
            summary: `${displayName} (Success)`
          });

          const chatState = agent.getState(ChatServiceState);

          const values: ToolResultOutput["value"] = [
            {type: "text", text: result.result}
          ];

          if (result.attachments) {
            values.push(
              ...await Promise.all(
                result.attachments
                .filter(a => a.sendToLLM)
                .map(async (result): Promise<ToolResultValue> => {
                  switch (result.mimeType) {
                    case 'application/json':
                    case 'text/plain':
                    case 'text/markdown':
                    case 'text/x-diff':
                    case "message/rfc822":
                    case "text/html":
                      return {
                        type: "text",
                        text: await decodeAsText(result.body, result.encoding, chatState)
                      };
                    case 'image/jpeg':
                    case 'image/png':
                      return {
                        type: "image-data",
                        data: result.body,
                        mediaType: result.mimeType
                      };
                    default: {
                      // noinspection JSUnusedLocalSymbols
                      const _foo: never = result.mimeType;
                      throw new Error(`Unsupported MIME type: ${result.mimeType as string}`);
                    }
                  }
                })
              )
            );
          }

          return {
            type: "content",
            value: values
          };
        };

        return await agent
          .getState(ChatServiceState)
          .runToolMaybeInParallel(executeToolFunction);
      }
    })
  };
}

function decodeAsText(body: string, encoding: BaseAttachment["encoding"], chatState: ChatServiceState): MaybePromise<string> {
  switch (encoding) {
    case "text":
      return body;
    case "base64":
      return Buffer.from(body, "base64").toString("utf-8");
    case "href":
      if (!chatState.currentConfig.allowRemoteAttachments) throw new Error("Remote attachments are not allowed");

      return fetch(body).then((res) => res.text());
    default: {
      // noinspection UnnecessaryLocalVariableJS
      const unknownEncoding: never = encoding;
      throw new Error(`Unsupported encoding: ${unknownEncoding as string}`);
    }
  }
}

/*
type ToolResultOutput = {
type: "content";
value: Array<{
  type: "text";
  text: string;
  providerOptions?: ProviderOptions;
} | {
  type: "media";
  data: string;
  mediaType: string;
} | {
  type: "file-data";
  data: string;
  mediaType: string;
  filename?: string;
  providerOptions?: ProviderOptions;
} | {
  type: "file-url";
  url: string;
  providerOptions?: ProviderOptions;
} | {
  type: "file-id";
  fileId: string | Record<string, string>;
  providerOptions?: ProviderOptions;
} | {
  type: "image-data";
  data: string;
  mediaType: string;
  providerOptions?: ProviderOptions;
} | {
  type: "image-url";
  url: string;
  providerOptions?: ProviderOptions;
} | {
  type: "image-file-id";
  fileId: string | Record<string, string>;
  providerOptions?: ProviderOptions;
} | {
  type: "custom";
  providerOptions?: ProviderOptions;
}>;
}
*/