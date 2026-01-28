import {Agent} from "@tokenring-ai/agent";
import {chatTool} from "@tokenring-ai/ai-client";
import {z} from "zod";
import {TokenRingToolDefinition, type TokenRingToolResult} from "../schema.ts";
import {ChatServiceState} from "../state/chatServiceState.ts";

export function tokenRingTool(toolDefinition: TokenRingToolDefinition<any>) {
  const {name, displayName, description, inputSchema, execute, skipArtifactOutput} = toolDefinition;
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
      ): Promise<TokenRingToolResult> {
        const agent = experimental_context.agent as Agent;

        const executeToolFunction = async (): Promise<TokenRingToolResult> => {
          try {
            const result = await execute(args, agent);

            if (!skipArtifactOutput) {
              generateArtifact(name, args, result, agent);
            }
            return result;
          } catch (err: any) {
            agent.errorMessage(
              `Error calling tool ${name}(${JSON.stringify(args)}): ${err}`,
            );
            return `Error calling tool: ${err.message || err}. Please check your tool call for correctness and retry the function call.`;
          }
        };

        return await agent
          .getState(ChatServiceState)
          .runToolMaybeInParallel(executeToolFunction);
      },

      toModelOutput({output}) {
        if (typeof output === "string") {
          return {type: "content", value: [{type: "text", text: output}]};
        }
        if (typeof output === "object" && output !== null && "type" in output) {
          if (output.type === "text" && "text" in output) {
            return {type: "content", value: [{type: "text", text: output.text}]};
          }
          if (output.type === "media" && "data" in output && "mediaType" in output) {
            return {type: "content", value: [{type: "media", data: output.data, mediaType: output.mediaType}]};
          }
          if (output.type === "json" && "data" in output) {
            return {type: "content", value: [{type: "text", text: JSON.stringify(output.data, null, 2)}]};
          }
        }
        return {type: "content", value: [{type: "text", text: JSON.stringify(output, null, 2)}]};
      }
    })
  };
}


function generateArtifact(name: string, args: Record<string,any>, result: TokenRingToolResult, agent: Agent) {
// Output an artifact showing the request JSON and response
  const requestJson = JSON.stringify(args, null, 2);
  if (typeof result === "string") {
    result = { type: "text", text: result };
  } else if (result.type === 'json') {
    result = { type: 'text', text: JSON.stringify(result.data, null, 2) };
  }

  switch (result.type) {
    case 'text': {
      agent.artifactOutput({
        name: `Tool Call (${name})`,
        encoding: "text",
        mimeType: "text/markdown",
        body: `
**Request JSON:**

\`\`\`json
${requestJson}
\`\`\`

**Response:**

\`\`\`
${result.text}
\`\`\`
`.trim()
      });
    }
      break;
    case 'media': {
      agent.artifactOutput({
        name: `Tool Call (${name})`,
        encoding: "base64",
        mimeType: result.mediaType,
        body: result.data,
      });
    }
      break;
  }
}