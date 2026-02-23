import Agent from "@tokenring-ai/agent/Agent";
import {OutputArtifactSchema} from "@tokenring-ai/agent/AgentEvents";

import type {Tool as AITool} from "@tokenring-ai/ai-client";
import type {AIResponse, ChatInputMessage, ChatRequest} from "@tokenring-ai/ai-client/client/AIChatClient";
import {z} from "zod";

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

type ToolArtifact = Omit<z.input<typeof OutputArtifactSchema>, "type" | "timestamp">

export type NamedTool = {
  name: string;
  tool: AITool;
  toolDefinition?: TokenRingToolDefinition<any>;
};

export type TokenRingToolTextResult = string | {
  type: 'text',
  text: string,
  artifact?: ToolArtifact,
}
export type TokenRingToolMediaResult = {
  type: 'media',
  mediaType: string,
  data: string,
  artifact?: ToolArtifact,
}

type AsJson<T> =
  T extends string | number | boolean | null ? T :
  T extends Function ? never :
  T extends object ? { [K in keyof T]: AsJson<T[K]> } :
    never;

export type TokenRingToolJSONResult<T> = {
  type: 'json',
  data: AsJson<T>;
  artifact?: ToolArtifact,
}

export type TokenRingToolResult = TokenRingToolTextResult | TokenRingToolMediaResult | TokenRingToolJSONResult<any>;

export type TokenRingToolDefinition<InputSchema extends AITool["inputSchema"]> = {
  /* The name of the tool, as seen by the model */
  name: string;
  /* The display name of the tool, as seen by the user */
  displayName: string;
  description: string;
  execute: (input: z.output<InputSchema>, agent: Agent) => Promise<TokenRingToolResult>;
  inputSchema: InputSchema;
  start?: (agent: Agent) => Promise<void>;
  stop?: (agent: Agent) => Promise<void>;
  requiredContextHandlers?: string[];
};

export const ContextSourceSchema = z.looseObject({
  type: z.string(),
});

export const ChatAgentConfigSchema = z.object({
  model: z.string().optional(),
  systemPrompt: z.union([z.string(), z.function({output: z.string()})]),
  maxSteps: z.number().optional(),
  autoCompact: z.boolean().optional(),
  enabledTools: z.array(z.string()).optional(),
  compactionThreshold: z.number().optional(),
  context: z.object({
    initial: z.array(ContextSourceSchema).default(initialContextItems),
    followUp: z.array(ContextSourceSchema).default(followUpContextItems),
  }).optional(),
}).strict();

const ChatAgentDefaultConfig = z.object({
  model: z.string().optional(),
  autoCompact: z.boolean().default(true),
  enabledTools: z.array(z.string()).default([]),
  maxSteps: z.number().default(0),
  compactionThreshold: z.number().default(0.7),
  context: z.object({
    initial: z.array(ContextSourceSchema).default(initialContextItems),
    followUp: z.array(ContextSourceSchema).default(followUpContextItems),
  }).prefault({}),
}).strict();

export const ChatServiceConfigSchema = z.object({
  defaultModels: z.array(z.string()).default([]),
  agentDefaults: ChatAgentDefaultConfig.prefault({}),
});

export const ChatConfigMergedSchema = z.object({
  ...ChatAgentConfigSchema.shape,
  ...ChatAgentDefaultConfig.shape,
});

export type ChatAgentConfig = {
  chat: z.input<typeof ChatAgentConfigSchema>
};

export type ParsedChatConfig = z.output<typeof ChatConfigMergedSchema>;
export type ContextItem = ChatInputMessage;
export type ContextHandler = (input: string, chatConfig: ParsedChatConfig, sourceParams: z.infer<typeof ContextSourceSchema>, agent: Agent) => AsyncGenerator<ContextItem>;

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
