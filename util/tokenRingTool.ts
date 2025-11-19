import {Agent} from "@tokenring-ai/agent";
import {chatTool} from "@tokenring-ai/ai-client";
import {ChatServiceState} from "../state/chatServiceState.ts";
import {TokenRingToolDefinition} from "../types.ts";

export function tokenRingTool({
                                name,
                                description,
                                inputSchema,
                                execute,
                              }: TokenRingToolDefinition) {
  return {
    name,
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
            agent.infoLine(`Calling tool ${name}`);
            const value = await execute(args, agent);
            return typeof value === "string"
              ? value
              : JSON.stringify(value, null, 1);
          } catch (err: any) {
            agent.errorLine(
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
