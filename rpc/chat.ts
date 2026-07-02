import type Agent from "@tokenring-ai/agent/Agent";
import AgentManager from "@tokenring-ai/agent/services/AgentManager";
import { SerializedChatModelSpecSchema } from "@tokenring-ai/ai-client/client/AIChatClient";
import { ChatModelRegistry } from "@tokenring-ai/ai-client/ModelRegistry";
import type TokenRingApp from "@tokenring-ai/app";
import { createAgentStateSliceStream } from "@tokenring-ai/rpc/createAgentStateStream";
import { createRPCEndpoint } from "@tokenring-ai/rpc/createRPCEndpoint";
import { deepEquals } from "bun";
import { z } from "zod";
import ChatService from "../ChatService.ts";
import { ChatServiceState } from "../state/chatServiceState.ts";
import ChatRpcSchema from "./schema.ts";

type ModelQueryResult =
  | { status: "agentNotFound" }
  | { status: "modelNotFound"}
  | {
      status: "success";
      model: string | null;
      modelSpec: z.output<typeof SerializedChatModelSpecSchema>
    };

function buildModelResult(chatService: ChatService, agent: Agent): ModelQueryResult {
  const model = chatService.getModel(agent);

  if (model) {
    const registry = agent.requireServiceByType(ChatModelRegistry);
    const client = registry.getClient(model);
    return {
      status: "success" as const,
      model,
      modelSpec: SerializedChatModelSpecSchema.parse(client.getModelSpec() satisfies z.input<typeof SerializedChatModelSpecSchema>)
    };
  } else {
    return {
      status: "modelNotFound"
    }
  }
}

const streamEnabledTools = createAgentStateSliceStream({
  SliceClass: ChatServiceState,
  project: state => ({
    status: "success" as const,
    tools: state.currentConfig.enabledTools ?? [],
  }),
});

export default createRPCEndpoint(ChatRpcSchema, {
  getAvailableTools(_args, app: TokenRingApp) {
    const chatService = app.requireService(ChatService);
    const tools = chatService.getAvailableToolEntries();
    return {
      tools: Object.fromEntries(tools.map(([toolName, tool]) => [toolName, { displayName: tool.toolDefinition?.displayName || toolName }])),
    };
  },

  getModel(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }
    return buildModelResult(app.requireService(ChatService), agent);
  },

  async *streamModel(args, app: TokenRingApp, signal) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      yield { status: "agentNotFound" };
      return;
    }

    const chatService = app.requireService(ChatService);
    let last: ModelQueryResult | undefined;

    for await (const _slice of agent.subscribeStateAsync(ChatServiceState, signal)) {
      const result = buildModelResult(chatService, agent);
      if (last !== undefined && deepEquals(last, result, true)) {
        continue;
      }
      last = result;
      yield result;
    }
  },

  setModel(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }
    const chatService = app.requireService(ChatService);
    chatService.setModel(args.model, agent);
    return { status: "success", success: true };
  },

  getEnabledTools(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }
    const chatService = app.requireService(ChatService);
    return {
      status: "success",
      tools: chatService.getEnabledTools(agent),
    };
  },

  streamEnabledTools,

  setEnabledTools(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }
    const chatService = app.requireService(ChatService);
    const tools = chatService.setEnabledTools(args.tools, agent);
    return { status: "success", tools };
  },

  enableTools(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }
    const chatService = app.requireService(ChatService);
    const tools = chatService.enableTools(args.tools, agent);
    return { status: "success", tools };
  },

  disableTools(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }
    const chatService = app.requireService(ChatService);
    const tools = chatService.disableTools(args.tools, agent);
    return { status: "success", tools };
  },

  getChatMessages(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }
    const chatService = app.requireService(ChatService);
    return {
      status: "success",
      messages: chatService.getChatMessages(agent),
    };
  },

  async clearChatMessages(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }
    const chatService = app.requireService(ChatService);
    await chatService.clearChatMessages(agent);
    return { status: "success", success: true };
  },
});
