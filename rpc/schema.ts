import { SerializedChatModelSpecSchema } from "@tokenring-ai/ai-client/client/AIChatClient";
import { SerializedModelSpecSchema } from "@tokenring-ai/ai-client/ModelTypeRegistry";
import { AgentNotFoundSchema } from "@tokenring-ai/rpc/types";
import { SuccessSchema } from "@tokenring-ai/rpc/types";
import type { RPCSchema } from "@tokenring-ai/rpc/types";
import { z } from "zod";

const ModelNotFoundSchema = z.object({
  status: z.literal("modelNotFound"),
});

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
        SuccessSchema.extend({
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
        SuccessSchema.extend({
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
        SuccessSchema.extend({
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
        SuccessSchema.extend({
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
        SuccessSchema.extend({
          success: z.boolean(),
        }),
        AgentNotFoundSchema,
      ]),
    },
  },
} satisfies RPCSchema;
