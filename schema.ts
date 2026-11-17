import type Agent from "@tokenring-ai/agent/Agent";
import type { ChatAttachment, ToolCallResult } from "@tokenring-ai/agent/AgentEvents";

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
    /** Stop the chat once estimated total cost (USD) for this turn reaches this amount. */
    maxCost: z.number().exactOptional(),
    /** Stop the chat once cumulative input tokens for this turn reach this amount. */
    maxInputTokens: z.number().exactOptional(),
    /** Stop the chat once cumulative output tokens for this turn reach this amount. */
    maxOutputTokens: z.number().exactOptional(),
    /** Stop the chat once this many seconds have elapsed for the current turn. */
    maxRuntime: z.number().exactOptional(),
    allowRemoteAttachments: z.boolean().exactOptional(),
    /** Auto-approve tool actions whose safety level is at or below this value (0–10). */
    autoToolApprovalLevel: z.number().int().min(0).max(10).exactOptional(),
    /**
     * How to handle tool actions above {@link autoToolApprovalLevel}:
     * - ask: prompt the user
     * - reject: deny without prompting
     * - auto: re-assess with the chat model, then auto-approve or ask
     */
    toolApprovalMode: z.enum(["ask", "reject", "auto"]).exactOptional(),
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
    parallelTools: z.boolean().exactOptional(),
    context: z
      .object({
        initial: z.array(ContextSourceSchema).default(initialContextItems),
        followUp: z.array(ContextSourceSchema).default(followUpContextItems),
      })
      .exactOptional(),
  })
  .strict();

export const ToolApprovalModeSchema = z.enum(["ask", "reject", "auto"]);
export type ToolApprovalMode = z.infer<typeof ToolApprovalModeSchema>;

/**
 * The tool approval standard (docs/docs/tool-approval-levels.md). A tool rates the action it is about
 * to take, not the tool in general: the same tool can be a 4 for a draft and an 8 when it sends.
 * Levels 1–6 stay within your own things; 7 and up reach shared systems, other people or the public.
 */
export const ToolApprovalClassificationLevels = {
  1: "Read, local: reads files, app state or local tools; changes nothing",
  2: "Read, remote: searches the web or reads a connected account (email, calendar, GitHub, a database); changes nothing",
  3: "Agent bookkeeping: changes only the agent's own working state (todos, goals, which tools are on, temporary files)",
  4: "Recoverable change to your own things: edits that keep the previous version, drafts nobody else sees, new notes, tasks or local commits, sandboxed builds and tests",
  5: "Change to your own things that takes effort to undo, or that costs money: moving or archiving email, removing local containers or images, paid generation, starting agents that work unattended once",
  6: "Permanent loss of some of your own data: deleting or overwriting files with no kept version, deleting notes, memories or tasks, trashing email, discarding local git changes, resetting a skill",
  7: "Change to a shared or external system that can be undone and notifies nobody, or bulk loss of your own data: uploading to cloud storage, database writes, editing a live post, editing or closing an issue or PR, recurring scheduled agents, running code outside the sandbox",
  8: "Reaches other people or the public, or cannot be undone outside your machine: sending email or messages, posting, commenting, invitations, git push, publishing packages, merging, deleting remote records, installing downloaded code",
  9: "Severe: wide irreversible loss, shared infrastructure or security: force push, dropping tables, pruning volumes, changing credentials or permissions, sudo, remote shells",
  10: "Catastrophic: can destroy the system or all data (wiping disks, formatting, rm -rf /, shutting the machine down)",
} as const;

/** Named levels of the tool approval standard ({@link ToolApprovalClassificationLevels}). */
export const ApprovalLevel = {
  ReadLocal: 1,
  ReadRemote: 2,
  Bookkeeping: 3,
  RecoverableChange: 4,
  CostlyChange: 5,
  OwnDataLoss: 6,
  SharedChange: 7,
  ReachesPeople: 8,
  Severe: 9,
  Catastrophic: 10,
} as const satisfies Record<string, ToolApprovalClassificationLevel>;

/**
 * In `auto` mode, actions at this level or above always go to a person: the classifier only judges
 * level 7, where a wrong guess can still be undone.
 */
export const ALWAYS_ASK_LEVEL = ApprovalLevel.ReachesPeople;

export type ToolApprovalClassificationLevel = keyof typeof ToolApprovalClassificationLevels;

/** Structured LLM output when toolApprovalMode is auto. */
export const ToolApprovalSafetyAssessmentSchema = z.object({
  level: z.number().int().min(1).max(10).describe("Safety risk classification from 1 (safest) to 10 (most dangerous)"),
  reasoning: z.string().describe("A single sentence explanation of why this classification level was chosen"),
});
export type ToolApprovalSafetyAssessment = z.infer<typeof ToolApprovalSafetyAssessmentSchema>;

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
    parallelTools: z
      .boolean()
      .default(false)
      .meta({ advanced: true, description: "Allow tools to be executed in parallel" } satisfies ConfigFieldMeta),
    maxSteps: z
      .number()
      .default(0)
      .meta({ advanced: true, description: "Maximum tool-call steps per turn (0 = unlimited)" } satisfies ConfigFieldMeta),
    maxCost: z
      .number()
      .exactOptional()
      .meta({
        advanced: true,
        description: "Maximum estimated cost in USD per turn; chat stops when this is reached",
      } satisfies ConfigFieldMeta),
    maxInputTokens: z
      .number()
      .exactOptional()
      .meta({
        advanced: true,
        description: "Maximum cumulative input tokens per turn; chat stops when this is reached",
      } satisfies ConfigFieldMeta),
    maxOutputTokens: z
      .number()
      .exactOptional()
      .meta({
        advanced: true,
        description: "Maximum cumulative output tokens per turn; chat stops when this is reached",
      } satisfies ConfigFieldMeta),
    maxRuntime: z
      .number()
      .exactOptional()
      .meta({
        advanced: true,
        description: "Maximum runtime in seconds per turn; chat stops when this is reached",
      } satisfies ConfigFieldMeta),
    allowRemoteAttachments: z
      .boolean()
      .default(true) //TODO: Evaluate security risks associated with this
      .meta({ advanced: true, description: "Allow agents to fetch attachments from remote URLs" } satisfies ConfigFieldMeta),
    autoToolApprovalLevel: z
      .number()
      .int()
      .min(0)
      .max(10)
      .default(6)
      .meta({
        advanced: true,
        description: "Auto-approve tool actions at or below this safety level (0–10). Higher levels use toolApprovalMode.",
      } satisfies ConfigFieldMeta),
    toolApprovalMode: ToolApprovalModeSchema.default("auto").meta({
      advanced: true,
      description: "How to handle tool actions above autoToolApprovalLevel: ask, reject, or auto",
    } satisfies ConfigFieldMeta),
    saveClassificationLogsToFile: z
      .string()
      .exactOptional()
      .meta({
        advanced: true,
        description: "File path to save tool approval classification logs to",
      } satisfies ConfigFieldMeta),
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

/** Highest approval level a permission grant can cover; levels 9-10 always ask a person. */
export const MAX_GRANTABLE_LEVEL = ApprovalLevel.ReachesPeople;

export const PermissionGrantSchema = z.object({
  id: z
    .string()
    .meta({ description: "Permission id, e.g. blog.mysite.publish. Hand-edited ids may use * (one segment) and ** (the rest)" } satisfies ConfigFieldMeta),
  grantedAt: z.string().meta({ description: "When the permission was granted (ISO 8601)" } satisfies ConfigFieldMeta),
  lastUsedAt: z
    .string()
    .exactOptional()
    .meta({ description: "When the permission last approved a request (ISO 8601)" } satisfies ConfigFieldMeta),
  uses: z
    .number()
    .int()
    .min(0)
    .exactOptional()
    .meta({ description: "How many requests the permission has approved" } satisfies ConfigFieldMeta),
  note: z
    .string()
    .exactOptional()
    .meta({ description: "What the permission covers, in plain language" } satisfies ConfigFieldMeta),
});
export type PermissionGrantConfig = z.output<typeof PermissionGrantSchema>;

export const PermissionsConfigSchema = z
  .object({
    maxGrantLevel: z
      .number()
      .int()
      .min(0)
      .max(MAX_GRANTABLE_LEVEL)
      .default(MAX_GRANTABLE_LEVEL)
      .meta({
        description: "Highest approval level a grant may cover (at most 8; levels 9-10 always ask)",
      } satisfies ConfigFieldMeta),
    grants: z
      .array(PermissionGrantSchema)
      .default([])
      .meta({ description: 'Standing permissions ("Always allow") that approve matching requests without asking' } satisfies ConfigFieldMeta),
  })
  .prefault({})
  .meta({
    label: "Permissions",
    description: "Standing permissions that approve specific actions without asking, including in unattended runs",
  } satisfies ConfigFieldMeta);

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
    permissions: PermissionsConfigSchema,
  })
  .prefault({})
  .meta({ label: "Chat", description: "Conversation and tool-use behavior for agents" } satisfies ConfigFieldMeta);

export type ChatServiceConfig = z.input<typeof ChatServiceConfigSchema>;
export type ParsedChatServiceConfig = z.output<typeof ChatServiceConfigSchema>;

export const ChatConfigMergedSchema = z.object({
  ...ChatAgentConfigSchema.shape,
  ...ChatAgentDefaultConfig.shape,
});

export {
  type ChatToolConfig,
  ChatToolConfigSchema,
  ChatToolInputArgumentSchema,
  type ToolDefinition,
  ToolDefinitionSchema,
  type ToolItem,
  type ToolItemInput,
  ToolItemSchema,
} from "./toolSchema.ts";

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
