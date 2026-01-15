import {Agent} from "@tokenring-ai/agent";
import {chatTool} from "@tokenring-ai/ai-client";
import {ChatServiceState} from "../state/chatServiceState.ts";
import {TokenRingToolDefinition} from "../schema.ts";



export function tokenRingTool<inputSchemaType>(toolDefinition: TokenRingToolDefinition<any>) {
  const {name, description, inputSchema, execute} = toolDefinition;
  return {
    name,
    toolDefinition,
    tool: chatTool({
      description,
      inputSchema,
      async execute(
        args: Record<string, any>,
        {experimental_context}: Record<string, any>,
      ): Promise<string | object> {
        const agent = experimental_context.agent as Agent;

        const executeToolFunction = async (): Promise<string> => {
          try {
            const value = await execute(args, agent);

            // Output an artifact showing the request JSON and response
            const requestJson = JSON.stringify(args, null, 2);
            const responseText = typeof value === "string"
              ? value
              : JSON.stringify(value, null, 1);

            const artifactBody = `### Tool Call: ${name}

**Request JSON:**

\`\`\`json
${requestJson}
\`\`\`

**Response:**

\`\`\`
${responseText}
\`\`\`
`;

            agent.artifactOutput({
              name: `Tool Call (${name})`,
              encoding: "text",
              mimeType: "text/markdown",
              body: artifactBody,
            });

            return responseText;
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
    }),
  };
}
