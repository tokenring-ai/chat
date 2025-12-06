import Agent from "@tokenring-ai/agent/Agent";

import type {Tool as AITool} from "@tokenring-ai/ai-client";
import type {AIResponse, ChatInputMessage, ChatRequest} from "@tokenring-ai/ai-client/client/AIChatClient";
import {z} from "zod";
import tool from "./commands/tool.ts";

const initialContextItems = [
  { type: "system-message" },
  { type: "tool-context" },
  { type: "prior-messages" },
  { type: "current-message" },
];

const followUpContextItems = [
  { type: "prior-messages" },
  { type: "current-message" },
]

export type NamedTool = {
  name: string;
  tool: AITool;
  toolDefinition?: TokenRingToolDefinition<any>;
};
export type TokenRingToolDefinition<InputSchema extends AITool["inputSchema"]> = {
  name: string;
  description: string;
  execute: (input: z.infer<InputSchema>, agent: Agent) => Promise<string | object>;
  inputSchema: InputSchema;
  start?: (agent: Agent) => Promise<void>;
  stop?: (agent: Agent) => Promise<void>;
  requiredContextHandlers?: string[];
};

export const ContextSourceSchema = z.looseObject({
  type: z.string(),
});

export const ChatConfigSchema = z.object({
  model: z.string().optional(),
  systemPrompt: z.union([z.string(), z.function({output: z.string()})]),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  maxSteps: z.number().default(30),
  topP: z.number().optional(),
  topK: z.number().optional(),
  frequencyPenalty: z.number().optional(),
  presencePenalty: z.number().optional(),
  stopSequences: z.array(z.string()).optional(),
  autoCompact: z.boolean().default(true),
  enabledTools: z.array(z.string()).default([]),
  context: z.object({
    initial: z.array(ContextSourceSchema).default(initialContextItems),
    followUp: z.array(ContextSourceSchema).default(followUpContextItems),
  }).default({initial: initialContextItems, followUp: followUpContextItems}),
});
export type ChatConfig = z.output<typeof ChatConfigSchema>;
export type ContextItem = ChatInputMessage;
export type ContextHandler = (input: string, chatConfig: ChatConfig, sourceParams: z.infer<typeof ContextSourceSchema>, agent: Agent) => AsyncGenerator<ContextItem>;

/**
 * Represents a chat message in the storage system
 */
export type StoredChatMessage = {
  /** The AI request */
  request: Omit<ChatRequest, "tools"> & { tools?: never };
  /** The response from AI */
  response: AIResponse;
  /** The creation time in milliseconds since the epoch format */
  createdAt: number;
  /** The update time in milliseconds since the epoch format */
  updatedAt: number;
}