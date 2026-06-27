import { AgentNotFoundSchema } from "@tokenring-ai/agent/schema";
import type { RPCSchema } from "@tokenring-ai/rpc/types";
import { z } from "zod";

export default {
  name: "Chat RPC",
  path: "/rpc/chat",
  methods: {
    getAvailableTools: {
      type: "query",
      input: z.object({}),
      result: z.object({
        tools: z.record(z.string(), z.object({ displayName: z.string() })),
      }),
    },
    getModel: {
      type: "query",
      input: z.object({
        agentId: z.string(),
      }),
      result: z.discriminatedUnion("status", [
        z.object({
          status: z.literal("success"),
          model: z.string().nullable(),
          modelSpec: z
            .object({
              modelId: z.string(),
              providerDisplayName: z.string(),
              maxContextLength: z.number(),
              costPerMillionInputTokens: z.number(),
              costPerMillionOutputTokens: z.number(),
              costPerMillionCachedInputTokens: z.number().optional(),
              costPerMillionReasoningTokens: z.number().optional(),
              maxCompletionTokens: z.number().optional(),
              tools: z.boolean(),
              structuredOutput: z.boolean(),
              webSearch: z.boolean().optional(),
              inputCapabilities: z
                .object({
                  text: z.boolean(),
                  image: z.union([z.boolean(), z.array(z.string())]),
                  video: z.union([z.boolean(), z.array(z.string())]),
                  audio: z.union([z.boolean(), z.array(z.string())]),
                  file: z.union([z.boolean(), z.array(z.string())]),
                })
                .partial()
                .optional(),
            })
            .nullable(),
        }),
        AgentNotFoundSchema,
      ]),
    },
    setModel: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        model: z.string(),
      }),
      result: z.discriminatedUnion("status", [
        z.object({
          status: z.literal("success"),
          success: z.boolean(),
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
        z.object({
          status: z.literal("success"),
          tools: z.array(z.string()),
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
        z.object({
          status: z.literal("success"),
          tools: z.array(z.string()),
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
        z.object({
          status: z.literal("success"),
          tools: z.array(z.string()),
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
        z.object({
          status: z.literal("success"),
          tools: z.array(z.string()),
        }),
        AgentNotFoundSchema,
      ]),
    },
    getChatMessages: {
      type: "query",
      input: z.object({
        agentId: z.string(),
      }),
      result: z.discriminatedUnion("status", [
        z.object({
          status: z.literal("success"),
          messages: z.array(
            z.object({
              request: z.any(),
              response: z.any(),
              createdAt: z.number(),
              updatedAt: z.number(),
            }),
          ),
        }),
        AgentNotFoundSchema,
      ]),
    },
    clearChatMessages: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
      }),
      result: z.discriminatedUnion("status", [
        z.object({
          status: z.literal("success"),
          success: z.boolean(),
        }),
        AgentNotFoundSchema,
      ]),
    },
  },
} satisfies RPCSchema;
