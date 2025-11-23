import Agent from "@tokenring-ai/agent/Agent";

import type {Tool as AITool} from "@tokenring-ai/ai-client";
import type {z} from "zod";

export type NamedTool = {
  name: string;
  tool: AITool;
};
export type TokenRingToolDefinition<InputSchema extends AITool["inputSchema"]> = {
  name: string;
  description: string;
  execute: (input: z.infer<InputSchema>, agent: Agent) => Promise<string | object>;
  inputSchema: InputSchema;
  start?: (agent: Agent) => Promise<void>;
  stop?: (agent: Agent) => Promise<void>;
};
export type TokenRingTool<InputSchema extends AITool["inputSchema"]> = {
  packageName: string;
} & TokenRingToolDefinition<InputSchema>;