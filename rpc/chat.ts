import AgentManager from "@tokenring-ai/agent/services/AgentManager";
import { ChatModelRegistry } from "@tokenring-ai/ai-client/ModelRegistry";
import type TokenRingApp from "@tokenring-ai/app";
import { createRPCEndpoint } from "@tokenring-ai/rpc/createRPCEndpoint";
import ChatService from "../ChatService.ts";
import ChatRpcSchema from "./schema.ts";

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
    const chatService = app.requireService(ChatService);
    const model = chatService.getModel(agent);

    let modelSpec = null;
    if (model) {
      try {
        const { base } = chatService.getModelAndSettings(agent);
        const registry = agent.requireServiceByType(ChatModelRegistry);
        const spec = registry.getClient(base).getModelSpec();
        modelSpec = {
          modelId: spec.modelId,
          providerDisplayName: spec.providerDisplayName,
          maxContextLength: spec.maxContextLength,
          costPerMillionInputTokens: spec.costPerMillionInputTokens,
          costPerMillionOutputTokens: spec.costPerMillionOutputTokens,
          ...(spec.costPerMillionCachedInputTokens !== undefined && { costPerMillionCachedInputTokens: spec.costPerMillionCachedInputTokens }),
          ...(spec.costPerMillionReasoningTokens !== undefined && { costPerMillionReasoningTokens: spec.costPerMillionReasoningTokens }),
          ...(spec.maxCompletionTokens !== undefined && { maxCompletionTokens: spec.maxCompletionTokens }),
          tools: spec.tools ?? true,
          structuredOutput: spec.structuredOutput ?? true,
          ...(spec.webSearch !== undefined && { webSearch: spec.webSearch }),
          ...(spec.inputCapabilities !== undefined && { inputCapabilities: spec.inputCapabilities }),
        };
      } catch {
        // Model spec unavailable (e.g. model not in registry)
      }
    }

    return {
      status: "success",
      model,
      modelSpec,
    };
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
