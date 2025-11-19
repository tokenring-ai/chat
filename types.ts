import Agent from "@tokenring-ai/agent/Agent";

import type {Tool as AITool} from "@tokenring-ai/ai-client";

export type NamedTool = {
  name: string;
  tool: AITool;
};
export type TokenRingToolDefinition = {
  name: string;
  description: string;
  execute: (input: object, agent: Agent) => Promise<string | object>;
  inputSchema: AITool["inputSchema"];
  start?: (agent: Agent) => Promise<void>;
  stop?: (agent: Agent) => Promise<void>;
};
export type TokenRingTool = {
  packageName: string;
} & TokenRingToolDefinition;