import {
  AIResponseCostSchema,
  LanguageModelUsageSchema,
  SerializedChatModelSpecSchema,
  SerializedModelSpecSchema,
} from "@tokenring-ai/ai-client/schema.client";
import type { RPCSchema } from "@tokenring-ai/rpc/types";
import { AgentNotFoundSchema, SuccessSchema } from "@tokenring-ai/rpc/types";
import { z } from "zod";
// toolSchema.ts is the light half of ../schema.ts, split out so this file — and therefore the client
// bundle — never pulls in the AI client the server-side chat schema depends on.
import { ToolDefinitionSchema, ToolItemSchema } from "../toolSchema.ts";

const ModelNotFoundSchema = z.object({
  status: z.literal("modelNotFound"),
});

// Mirrors ToolApprovalModeSchema in ../schema.ts; redeclared here so the client bundle
// only ever pulls in this file, never the server-side chat schema.
const ToolApprovalModeSchema = z.enum(["ask", "reject", "auto"]);
const AutoToolApprovalLevelSchema = z.number().int().min(0).max(10);

const ToolApprovalSettingsSchema = SuccessSchema.extend({
  autoToolApprovalLevel: AutoToolApprovalLevelSchema,
  toolApprovalMode: ToolApprovalModeSchema,
});

const PermissionGrantInfoSchema = z.object({
  id: z.string(),
  summary: z.string().exactOptional(),
  grantedAt: z.string(),
  lastUsedAt: z.string().exactOptional(),
  uses: z.number().int(),
  source: z.enum(["global", "workspace"]),
  /** Set when the grant approves nothing (untrusted config file, malformed id), and why. */
  ignoredReason: z.string().exactOptional(),
});

const PermissionGrantsSchema = SuccessSchema.extend({
  grants: z.array(PermissionGrantInfoSchema),
  /** Highest approval level a grant can cover (at most 8). */
  maxGrantLevel: z.number().int(),
});

const PermissionRejectedSchema = z.object({
  status: z.literal("rejected"),
  message: z.string(),
});

export default {
  name: "Chat RPC",
  path: "/rpc/chat",
  methods: {
    getAvailableTools: {
      type: "query",
      input: z.object({}),
      result: z.object({
        tools: z.record(
          z.string(),
          z.object({
            displayName: z.string(),
            /** The tool's model-facing description; empty when the tool has no definition. */
            description: z.string().default(""),
          }),
        ),
      }),
    },
    listPermissionGrants: {
      type: "query",
      input: z.object({}),
      result: PermissionGrantsSchema,
    },
    streamPermissionGrants: {
      type: "stream",
      input: z.object({}),
      result: PermissionGrantsSchema,
    },
    revokePermissionGrant: {
      type: "mutation",
      input: z.object({ id: z.string() }),
      result: z.discriminatedUnion("status", [SuccessSchema.extend({ id: z.string() }), z.object({ status: z.literal("notFound") }), PermissionRejectedSchema]),
    },
    grantPermission: {
      type: "mutation",
      input: z.object({ id: z.string(), summary: z.string().exactOptional() }),
      result: z.discriminatedUnion("status", [SuccessSchema.extend({ grant: PermissionGrantInfoSchema }), PermissionRejectedSchema]),
    },
    getToolDirectory: {
      type: "query",
      input: z.object({}),
      result: z.object({
        directory: z.string(),
      }),
    },
    listToolDefinitions: {
      type: "query",
      input: z.object({}),
      result: z.array(ToolDefinitionSchema),
    },
    getToolDefinition: {
      type: "query",
      input: z.object({
        name: z.string(),
      }),
      result: z.discriminatedUnion("status", [SuccessSchema.extend({ tool: ToolDefinitionSchema }), z.object({ status: z.literal("toolNotFound") })]),
    },
    createToolDefinition: {
      type: "mutation",
      input: z.object({
        name: z.string(),
        tool: ToolItemSchema,
      }),
      result: z.object({
        tool: ToolDefinitionSchema,
      }),
    },
    updateToolDefinition: {
      type: "mutation",
      input: z.object({
        name: z.string(),
        tool: ToolItemSchema,
      }),
      result: z.object({
        tool: ToolDefinitionSchema,
      }),
    },
    deleteToolDefinition: {
      type: "mutation",
      input: z.object({
        name: z.string(),
      }),
      result: z.object({
        success: z.boolean(),
      }),
    },
    getModel: {
      type: "query",
      input: z.object({
        agentId: z.string(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          model: z.string().nullable(),
          modelSpec: SerializedChatModelSpecSchema,
        }),
        AgentNotFoundSchema,
        ModelNotFoundSchema,
      ]),
    },
    streamModel: {
      type: "stream",
      input: z.object({
        agentId: z.string(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          model: z.string().nullable(),
          modelSpec: SerializedModelSpecSchema,
        }),
        AgentNotFoundSchema,
        ModelNotFoundSchema,
      ]),
    },
    setModel: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        model: z.string(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          success: z.boolean(),
        }),
        AgentNotFoundSchema,
        // The model is not registered (or its settings are invalid); nothing was stored.
        ModelNotFoundSchema,
      ]),
    },
    streamChatUsage: {
      type: "stream",
      input: z.object({
        agentId: z.string(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          model: z.string().nullable(),
          cost: AIResponseCostSchema,
          contextLength: z.number(),
          maxContextLength: z.number().int().nonnegative().nullable(),
          totalUsage: LanguageModelUsageSchema,
          toolCount: z.number().int().nonnegative(),
        }),
        AgentNotFoundSchema,
      ]),
    },

    getEnabledTools: {
      type: "query",
      input: z.object({
        agentId: z.string(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          tools: z.array(z.string()),
        }),
        AgentNotFoundSchema,
      ]),
    },
    streamEnabledTools: {
      type: "stream",
      input: z.object({
        agentId: z.string(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          tools: z.array(z.string()).readonly(),
        }),
        AgentNotFoundSchema,
      ]),
    },
    setEnabledTools: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        tools: z.array(z.string()),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          tools: z.array(z.string()).readonly(),
        }),
        AgentNotFoundSchema,
      ]),
    },
    enableTools: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        tools: z.array(z.string()),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          tools: z.array(z.string()).readonly(),
        }),
        AgentNotFoundSchema,
      ]),
    },
    disableTools: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        tools: z.array(z.string()),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          tools: z.array(z.string()).readonly(),
        }),
        AgentNotFoundSchema,
      ]),
    },
    getToolApprovalLevels: {
      type: "query",
      input: z.object({}),
      result: z.object({
        levels: z.array(
          z.object({
            level: AutoToolApprovalLevelSchema,
            description: z.string(),
          }),
        ),
      }),
    },
    streamToolApproval: {
      type: "stream",
      input: z.object({
        agentId: z.string(),
      }),
      result: z.discriminatedUnion("status", [ToolApprovalSettingsSchema, AgentNotFoundSchema]),
    },
    setToolApproval: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        autoToolApprovalLevel: AutoToolApprovalLevelSchema.exactOptional(),
        toolApprovalMode: ToolApprovalModeSchema.exactOptional(),
      }),
      result: z.discriminatedUnion("status", [ToolApprovalSettingsSchema, AgentNotFoundSchema]),
    },
    clearChatMessages: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          success: z.boolean(),
        }),
        AgentNotFoundSchema,
      ]),
    },
    searchContext: {
      type: "stream",
      input: z.object({
        agentId: z.string(),
        query: z.string(),
        limit: z.number().int().positive().max(25).default(8).exactOptional(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          categories: z.array(
            z.object({
              id: z.string(),
              label: z.string(),
              items: z.array(
                z.object({
                  id: z.string(),
                  tag: z.string(),
                  title: z.string(),
                  subtitle: z.string().exactOptional(),
                  categoryId: z.string(),
                  categoryLabel: z.string(),
                  score: z.number().exactOptional(),
                }),
              ),
            }),
          ),
          pending: z.array(
            z.object({
              id: z.string(),
              categoryId: z.string(),
              categoryLabel: z.string(),
            }),
          ),
        }),
        AgentNotFoundSchema,
      ]),
    },
  },
} satisfies RPCSchema;
