import {JsonRPCSchema} from "@tokenring-ai/web-host/jsonrpc/types";
import {z} from "zod";

export default {
  path: "/rpc/chat",
  methods: {
    getAvailableTools: {
      type: "query",
      input: z.object({}),
      result: z.object({
        tools: z.array(z.string())
      })
    },
    getModel: {
      type: "query",
      input: z.object({
        agentId: z.string()
      }),
      result: z.object({
        model: z.string().nullable()
      })
    },
    setModel: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        model: z.string()
      }),
      result: z.object({
        success: z.boolean()
      })
    },
    getEnabledTools: {
      type: "query",
      input: z.object({
        agentId: z.string()
      }),
      result: z.object({
        tools: z.array(z.string())
      })
    },
    setEnabledTools: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        tools: z.array(z.string())
      }),
      result: z.object({
        tools: z.array(z.string())
      })
    },
    enableTools: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        tools: z.array(z.string())
      }),
      result: z.object({
        tools: z.array(z.string())
      })
    },
    disableTools: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        tools: z.array(z.string())
      }),
      result: z.object({
        tools: z.array(z.string())
      })
    },
    getChatMessages: {
      type: "query",
      input: z.object({
        agentId: z.string()
      }),
      result: z.object({
        messages: z.array(z.object({
          request: z.any(),
          response: z.any(),
          createdAt: z.number(),
          updatedAt: z.number()
        }))
      })
    },
    clearChatMessages: {
      type: "mutation",
      input: z.object({
        agentId: z.string()
      }),
      result: z.object({
        success: z.boolean()
      })
    }
  }
} satisfies JsonRPCSchema;
