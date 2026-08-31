import type Agent from "@tokenring-ai/agent/Agent";
import { createAgentStateSliceStream } from "@tokenring-ai/agent/rpc/createAgentStateStream";
import AgentManager from "@tokenring-ai/agent/services/AgentManager";
import { ChatModelRegistry } from "@tokenring-ai/ai-client/ModelRegistry";
import { AIResponseCostSchema, LanguageModelUsageSchema, SerializedChatModelSpecSchema } from "@tokenring-ai/ai-client/schema.client";
import type TokenRingApp from "@tokenring-ai/app";
import { createRPCEndpoint } from "@tokenring-ai/rpc/createRPCEndpoint";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import { deepEquals } from "bun";
import type { z } from "zod";
import ChatService from "../ChatService.ts";
import ContextualSearchService from "../ContextualSearchService.ts";
import { type ParsedChatConfig, ToolApprovalClassificationLevels } from "../schema.ts";
import { ChatServiceState } from "../state/chatServiceState.ts";
import ToolDirectoryService from "../ToolDirectoryService.ts";
import ChatRpcSchema from "./schema.ts";

type ModelQueryResult =
  | { status: "agentNotFound" }
  | { status: "modelNotFound" }
  | {
      status: "success";
      model: string | null;
      modelSpec: z.output<typeof SerializedChatModelSpecSchema>;
    };

function buildModelResult(chatService: ChatService, agent: Agent): ModelQueryResult {
  const model = chatService.getModel(agent);

  if (model) {
    const registry = agent.requireService(ChatModelRegistry);
    const client = registry.getClient(model);
    return {
      status: "success" as const,
      model,
      modelSpec: SerializedChatModelSpecSchema.parse(client.getModelSpec() satisfies z.input<typeof SerializedChatModelSpecSchema>),
    };
  } else {
    return {
      status: "modelNotFound",
    };
  }
}

const streamEnabledTools = createAgentStateSliceStream({
  SliceClass: ChatServiceState,
  project: state => ({
    status: "success" as const,
    tools: state.currentConfig.enabledTools,
  }),
});

const streamToolApproval = createAgentStateSliceStream({
  SliceClass: ChatServiceState,
  project: state => ({
    status: "success" as const,
    autoToolApprovalLevel: state.currentConfig.autoToolApprovalLevel,
    toolApprovalMode: state.currentConfig.toolApprovalMode,
  }),
  equals: (a, b) => a.autoToolApprovalLevel === b.autoToolApprovalLevel && a.toolApprovalMode === b.toolApprovalMode,
});

const streamChatUsage = createAgentStateSliceStream({
  SliceClass: ChatServiceState,
  project: (state, agent) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const model = state.currentConfig.model ?? null;
    const maxContextLength = model ? agent.requireService(ChatModelRegistry).getClient(model).getModelSpec().maxContextLength : null;

    return {
      status: "success" as const,
      model,
      cost: AIResponseCostSchema.parse(lastMessage?.response.cost ?? {}),
      contextLength: state.contextLength,
      maxContextLength,
      totalUsage: LanguageModelUsageSchema.parse(lastMessage?.response.totalUsage),
      //lastStepUsage: LanguageModelUsageSchema.parse(lastMessage?.response.lastStepUsage),
      toolCount: state.currentConfig.enabledTools.length,
    };
  },
});

export default createRPCEndpoint(ChatRpcSchema, {
  getAvailableTools(_args, app: TokenRingApp) {
    const chatService = app.requireService(ChatService);
    const tools = chatService.getAvailableToolEntries();
    return {
      tools: Object.fromEntries(tools.map(([toolName, tool]) => [toolName, { displayName: tool.toolDefinition?.displayName || toolName }])),
    };
  },

  getToolDirectory(_args, app: TokenRingApp) {
    return { directory: app.requireService(ToolDirectoryService).getToolDirectory() };
  },

  listToolDefinitions(_args, app: TokenRingApp) {
    return app.requireService(ToolDirectoryService).listToolDefinitions();
  },

  async getToolDefinition(args, app: TokenRingApp) {
    const tool = await app.requireService(ToolDirectoryService).getToolDefinition(args.name);
    if (!tool) {
      return { status: "toolNotFound" };
    }
    return { status: "success", tool };
  },

  async createToolDefinition(args, app: TokenRingApp) {
    const tool = await app.requireService(ToolDirectoryService).createToolDefinition(args.name, args.tool);
    return { tool };
  },

  async updateToolDefinition(args, app: TokenRingApp) {
    const tool = await app.requireService(ToolDirectoryService).updateToolDefinition(args.name, args.tool);
    return { tool };
  },

  async deleteToolDefinition(args, app: TokenRingApp) {
    const success = await app.requireService(ToolDirectoryService).deleteToolDefinition(args.name);
    return { success };
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

  streamChatUsage,

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

  getToolApprovalLevels() {
    return {
      levels: Object.entries(ToolApprovalClassificationLevels).map(([level, description]) => ({
        level: Number(level),
        description,
      })),
    };
  },

  streamToolApproval,

  setToolApproval(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }
    const chatService = app.requireService(ChatService);
    const updates: Partial<ParsedChatConfig> = {};
    if (args.autoToolApprovalLevel !== undefined) {
      updates.autoToolApprovalLevel = args.autoToolApprovalLevel;
    }
    if (args.toolApprovalMode !== undefined) {
      updates.toolApprovalMode = args.toolApprovalMode;
    }
    chatService.updateChatConfig(updates, agent);

    const config = chatService.getChatConfig(agent);
    return {
      status: "success",
      autoToolApprovalLevel: config.autoToolApprovalLevel,
      toolApprovalMode: config.toolApprovalMode,
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

  async *searchContext(args, app: TokenRingApp, signal) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      yield { status: "agentNotFound" };
      return;
    }
    for await (const snapshot of app.requireService(ContextualSearchService).searchStream(args.query, agent, { limitPerProvider: args.limit ?? 8 }, signal)) {
      if (signal.aborted) return;
      yield {
        status: "success" as const,
        categories: snapshot.categories.map(category => ({
          ...category,
          items: category.items.map(item => stripUndefinedKeys(item)),
        })),
        pending: snapshot.pending,
      };
    }
  },
});
