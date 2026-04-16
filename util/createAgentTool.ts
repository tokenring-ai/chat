import {type RunSubAgentOptions, SubAgentService} from "@tokenring-ai/agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {AfterSubAgentResponse} from "@tokenring-ai/agent/hooks";
import type {TokenRingToolDefinition} from "@tokenring-ai/chat";
import {AgentLifecycleService} from "@tokenring-ai/lifecycle";
import interpolateString from "@tokenring-ai/utility/string/interpolateString";
import {z} from "zod";
import type {ChatToolConfig} from "../schema.ts";

/**
 * Register an agent as a callable tool
 */

export function createAgentTool(
  toolName: string,
  toolConfig: ChatToolConfig
) {
  const inputSchemaEntries = Object.entries(toolConfig.inputArguments).map(
    ([name, arg]) => [
      name,
      arg.defaultValue
        ? z.string().describe(arg.description).default(arg.defaultValue)
        : z.string().describe(arg.description),
    ],
  );

  const inputSchema = z.object(Object.fromEntries(inputSchemaEntries));

  const toolDefinition: TokenRingToolDefinition<typeof inputSchema> = {
    name: toolName,
    displayName: toolConfig.displayName,
    description: toolConfig.description,
    inputSchema,

    execute: async (args, agent): Promise<string> => {
      const replacements: Record<string, () => string> = {};
      for (const key of Object.keys(toolConfig.inputArguments)) {
        replacements[key] = () => (args[key] as string) ?? "undefined";
      }

      const steps = toolConfig.steps.map((step) =>
        interpolateString(step, replacements),
      );

      const subAgentService = agent.requireServiceByType(SubAgentService);
      const request: RunSubAgentOptions = {
        agentType: toolConfig.agentType,
        background: false,
        headless: agent.headless,
        from: `Parent agent tool: /${toolName}`,
        steps,
        parentAgent: agent,
        options: toolConfig.subAgent,
      };

      const result = await subAgentService.runSubAgent(request);

      const lifecycleService = agent.getServiceByType(AgentLifecycleService);
      await lifecycleService?.executeHooks(
        new AfterSubAgentResponse(request, result),
        agent,
      );

      if (result.status === "success") {
        return result.response || "Agent completed successfully.";
      } else if (result.status === "cancelled") {
        throw new CommandFailedError(`Agent was cancelled: ${result.response}`);
      } else {
        throw new CommandFailedError(`Agent error: ${result.response}`);
      }
    },
  };

  return toolDefinition;
}
