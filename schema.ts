import type Agent from "@tokenring-ai/agent/Agent";
import type { ChatAttachment, ToolCallResult } from "@tokenring-ai/agent/AgentEvents";
import { SubAgentConfigSchema } from "@tokenring-ai/agent/schema";

import type { Tool as AITool } from "@tokenring-ai/ai-client";
import type { ChatInputMessage } from "@tokenring-ai/ai-client/client/AIChatClient";
import { AIResponseSchema, ChatInputMessageSchema } from "@tokenring-ai/ai-client/client/AIChatClient";
import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import type { MaybePromise } from "bun";
import type { ZodObject } from "zod";
import { z } from "zod";

const initialContextItems = [{ type: "tool-context" }, { type: "prior-messages" }, { type: "current-message" }];

const followUpContextItems = [{ type: "prior-messages" }, { type: "current-message" }];

export type NamedTool<InputSchema extends ZodObject<{}, z.core.$strip> = ZodObject<{}, z.core.$strip>> = {
  name: string;
  displayName: string;
  tool: (agent: Agent) => AITool;
  toolDefinition?: TokenRingToolDefinition<InputSchema>;
};

export type TokenRingFullToolResult = Omit<ToolCallResult, "type" | "timestamp" | "name" | "args">;

export type TokenRingToolResult = TokenRingFullToolResult;

export type TokenRingToolDefinition<InputSchema extends ZodObject<{}, z.core.$strip> = ZodObject<{}, z.core.$strip>> = {
  /* The name of the tool, as seen by the model */
  name: string;
  /* The display name of the tool, as seen by the user */
  displayName: string;
  description: string;
  execute: (input: z.output<InputSchema>, agent: Agent) => MaybePromise<TokenRingToolResult>;
  inputSchema: InputSchema;
  start?: (agent: Agent) => Promise<void>;
  stop?: (agent: Agent) => Promise<void>;
  requiredContextHandlers?: string[] | undefined;
  adjustActivation?: (enabled: boolean, agent: Agent) => boolean | Promise<boolean>;
};

export const ContextSourceSchema = z.looseObject({
  type: z.string(),
});

export const ChatAgentConfigSchema = z
  .object({
    model: z.string().exactOptional(),
    transcriptionModel: z.string().exactOptional(),
    systemPrompt: z.string(),
    maxSteps: z.number().exactOptional(),
    allowRemoteAttachments: z.boolean().exactOptional(),
    compaction: z
      .object({
        policy: z.enum(["automatic", "ask", "never"]).exactOptional(),
        compactionThreshold: z.number().exactOptional(),
        applyThreshold: z.number().exactOptional(),
        background: z.boolean().exactOptional(),
        focus: z.string().exactOptional(),
      })
      .prefault({}),
    enabledTools: z.array(z.string()).exactOptional(),
    hiddenTools: z.array(z.string()).exactOptional(),
    context: z
      .object({
        initial: z.array(ContextSourceSchema).default(initialContextItems),
        followUp: z.array(ContextSourceSchema).default(followUpContextItems),
      })
      .exactOptional(),
  })
  .strict();

const ChatAgentDefaultConfig = z
  .object({
    model: z
      .string()
      .exactOptional()
      .meta({ description: "Model new agents use by default" } satisfies ConfigFieldMeta),
    transcriptionModel: z
      .string()
      .exactOptional()
      .meta({ advanced: true, description: "Model used to transcribe audio attachments" } satisfies ConfigFieldMeta),
    enabledTools: z
      .array(z.string())
      .default([])
      .meta({ description: "Tools enabled by default for new agents" } satisfies ConfigFieldMeta),
    hiddenTools: z
      .array(z.string())
      .default([])
      .meta({ advanced: true, description: "Tools hidden from new agents" } satisfies ConfigFieldMeta),
    maxSteps: z
      .number()
      .default(0)
      .meta({ advanced: true, description: "Maximum tool-call steps per turn (0 = unlimited)" } satisfies ConfigFieldMeta),
    allowRemoteAttachments: z
      .boolean()
      .default(true) //TODO: Evaluate security risks associated with this
      .meta({ advanced: true, description: "Allow agents to fetch attachments from remote URLs" } satisfies ConfigFieldMeta),
    compaction: z
      .object({
        policy: z
          .enum(["automatic", "ask", "never"])
          .default("ask")
          .meta({ description: "When to compact long conversation history" } satisfies ConfigFieldMeta),
        compactionThreshold: z
          .number()
          .default(0.5)
          .meta({ advanced: true, description: "Context usage fraction that triggers compaction" } satisfies ConfigFieldMeta),
        applyThreshold: z
          .number()
          .exactOptional()
          .meta({ advanced: true, description: "Context usage fraction at which compaction is applied" } satisfies ConfigFieldMeta),
        background: z
          .boolean()
          .default(false)
          .meta({ advanced: true, description: "Run compaction in the background instead of blocking the turn" } satisfies ConfigFieldMeta),
        focus: z.string().default(
          `
- Important Details
- Resources, files, or URLs that were referenced
- A clear description of the current task
- A summary of the previous steps taken
- Key details about the current task
- Any other relevant information that might be useful for the current task
    `.trim(),
        ),
      })
      .prefault({})
      .meta({ label: "Compaction", advanced: true, description: "Long conversation history compaction behavior" } satisfies ConfigFieldMeta),
    context: z
      .object({
        initial: z.array(ContextSourceSchema).default(initialContextItems),
        followUp: z.array(ContextSourceSchema).default(followUpContextItems),
      })
      .prefault({})
      .meta({ label: "Context", advanced: true, description: "Context items included in outgoing messages" } satisfies ConfigFieldMeta),
  })
  .strict();

export const ChatServiceConfigSchema = z
  .object({
    defaultModels: z
      .array(z.string())
      .default([])
      .meta({ description: "Model fallback chain used when no model is specified" } satisfies ConfigFieldMeta),
    defaultTranscriptionModels: z
      .array(z.string())
      .default([])
      .meta({ advanced: true, description: "Transcription model fallback chain" } satisfies ConfigFieldMeta),
    agentDefaults: ChatAgentDefaultConfig.prefault({}).meta({ label: "Agent Defaults" } satisfies ConfigFieldMeta),
  })
  .meta({ label: "Chat", description: "Conversation and tool-use behavior for agents" } satisfies ConfigFieldMeta);

export const ChatConfigMergedSchema = z.object({
  ...ChatAgentConfigSchema.shape,
  ...ChatAgentDefaultConfig.shape,
});

export const ChatToolInputArgumentSchema = z.object({
  description: z.string(),
  defaultValue: z.string().exactOptional(),
});

export const ChatToolConfigSchema = z.object({
  /** Type of agent used to execute the tool */
  agentType: z.string(),
  /** Tool Display Name */
  displayName: z.string(),
  /** Tool Description */
  description: z.string(),
  /** Tool Input Schema */
  inputArguments: z.record(z.string(), ChatToolInputArgumentSchema),
  /** The steps to execute */
  steps: z.array(z.string()).min(1),
  /** The subagent configuration */
  subAgent: SubAgentConfigSchema.prefault({}),
});
export type ChatToolConfig = z.infer<typeof ChatToolConfigSchema>;

export type ChatAgentConfig = {
  chat: z.input<typeof ChatAgentConfigSchema>;
};

export function hasChatConfig<T extends object>(config: T): config is T & ChatAgentConfig {
  return "chat" in config;
}

export type ParsedChatConfig = z.output<typeof ChatConfigMergedSchema>;
export type ContextItem = ChatInputMessage;

export type ContextHandlerOptions = {
  input: string;
  attachments?: ChatAttachment[];
  chatConfig: ParsedChatConfig;
  sourceConfig: z.infer<typeof ContextSourceSchema>;
  agent: Agent;
};
export type ContextHandler = (options: ContextHandlerOptions) => AsyncGenerator<ContextItem> | Generator<ContextItem>;

/**
 * Represents a chat message in the storage system
 */
export const StoredChatMessageSchema = z.object({
  /** The system prompt */
  instructions: z.string(),
  /** The conversation messages */
  messages: z.array(ChatInputMessageSchema),
  /** The response from AI */
  response: AIResponseSchema,
  /** The creation time in milliseconds since the epoch format */
  createdAt: z.number(),
  /** The update time in milliseconds since the epoch format */
  updatedAt: z.number(),
});

export type StoredChatMessage = z.infer<typeof StoredChatMessageSchema>;

export const StoredChatCompactionSchema = z.object({
  startIndex: z.number().int().nonnegative(),
  endIndex: z.number().int().nonnegative(),
  messages: z.array(ChatInputMessageSchema),
  createdAt: z.number(),
});

export type StoredChatCompaction = {
  startIndex: number;
  endIndex: number;
  messages: ChatInputMessage[];
  createdAt: number;
};
