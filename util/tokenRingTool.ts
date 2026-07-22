import type { Agent } from "@tokenring-ai/agent";
import type { BaseAttachment } from "@tokenring-ai/agent/AgentEvents";
import { chatTool } from "@tokenring-ai/ai-client";
import formatError from "@tokenring-ai/utility/error/formatError";
import codeBlock from "@tokenring-ai/utility/string/codeBlock";
import type { MaybePromise } from "bun";
import type { ZodObject, z } from "zod";
import type { NamedTool, TokenRingFullToolResult, TokenRingToolDefinition } from "../schema.ts";
import { ChatServiceState } from "../state/chatServiceState.ts";

export class ToolCallError extends Error {
  constructor(
    public readonly toolName: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(`[${toolName}] ${message}`, options);
  }
}

//TODO: This is fucking stupid but less pain than the alternatives
export type ToolResultValue =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "file-data";
      data: string;
      mediaType: string;
      filename?: string | undefined;
    }
  | {
      type: "file-url";
      url: string;
    }
  | {
      type: "image-data";
      data: string;
      mediaType: string;
    }
  | {
      type: "image-url";
      url: string;
    };

export type ToolResultOutput = {
  type: "content";
  value: Array<ToolResultValue>;
};

export function tokenRingTool<ToolInputSchema extends ZodObject<{}, z.core.$strip>>(
  toolDefinition: TokenRingToolDefinition<ToolInputSchema>,
): NamedTool<ToolInputSchema> {
  const { name, displayName, description, inputSchema, execute } = toolDefinition;
  return {
    name,
    displayName,
    toolDefinition,
    tool: (agent: Agent) =>
      chatTool({
        description,
        inputSchema,
        async execute(args: z.output<typeof inputSchema>): Promise<ToolResultOutput> {
          const executeToolFunction = async (): Promise<ToolResultOutput> => {
            let result: TokenRingFullToolResult;
            try {
              result = await execute(args, agent);
            } catch (err) {
              agent.errorMessage(`**Error calling tool ${name}(${JSON.stringify(args)}):`, err);
              result = {
                message: `**Tool Call Failure** An error was thrown while calling tool ${displayName}`,
                attachments: [
                  {
                    name: "Tool Call Debugging Information",
                    mimeType: "text/markdown",
                    body: `## Tool Call Error   
### Tool Name:
${displayName}

### Arguments:
${codeBlock(JSON.stringify(args, null, 2), "json")}

### Stack Trace:
${codeBlock(formatError(err), "text")}`,
                    encoding: "text",
                    sendToLLM: true,
                  },
                ],
                result: `An error was thrown while calling the tool. Use your best judgement on whether to retry the tool call or to use a different strategy.`,
              };
            }

            agent.toolCallResult({
              name,
              args,
              ...result,
            });

            const chatState = agent.getState(ChatServiceState);

            const values: ToolResultOutput["value"] = [{ type: "text", text: result.result }];

            if (result.attachments) {
              values.push(
                ...(await Promise.all(
                  result.attachments
                    .filter(a => a.sendToLLM)
                    .map(async (result): Promise<ToolResultValue> => {
                      switch (result.mimeType) {
                        case "application/json":
                        case "text/plain":
                        case "text/markdown":
                        case "text/x-diff":
                        case "message/rfc822":
                        case "text/html":
                          return {
                            type: "text",
                            text: await decodeAsText(result.body, result.encoding, chatState),
                          };
                        case "image/jpeg":
                        case "image/png":
                          return {
                            type: "image-data",
                            data: result.body,
                            mediaType: result.mimeType,
                          };
                        default: {
                          const exhaustive: any = result.mimeType satisfies never;
                          throw new Error(`Unsupported MIME type: ${exhaustive}`);
                        }
                      }
                    }),
                )),
              );
            }

            return {
              type: "content",
              value: values,
            };
          };

          return await agent.getState(ChatServiceState).runToolMaybeInParallel(executeToolFunction);
        },
      }),
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

      return fetch(body).then(res => res.text());
    default: {
      const exhaustive: any = encoding satisfies never;
      throw new Error(`Unsupported encoding: ${exhaustive}`);
    }
  }
}
