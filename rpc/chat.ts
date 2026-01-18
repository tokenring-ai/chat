import TokenRingApp from "@tokenring-ai/app";
import {createJsonRPCEndpoint} from "@tokenring-ai/web-host/jsonrpc/createJsonRPCEndpoint";
import AgentManager from "@tokenring-ai/agent/services/AgentManager";
import ChatService from "../ChatService.js";
import ChatRpcSchema from "./schema.ts";

export default createJsonRPCEndpoint(ChatRpcSchema, {
  getAvailableTools(_args, app: TokenRingApp) {
    const chatService = app.requireService(ChatService);
    return {
      tools: chatService.getAvailableToolNames()
    };
  },

  getModel(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) throw new Error("Agent not found");
    const chatService = app.requireService(ChatService);
    return {
      model: chatService.getModel(agent)
    };
  },

  setModel(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) throw new Error("Agent not found");
    const chatService = app.requireService(ChatService);
    chatService.setModel(args.model, agent);
    return { success: true };
  },

  getEnabledTools(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) throw new Error("Agent not found");
    const chatService = app.requireService(ChatService);
    return {
      tools: chatService.getEnabledTools(agent)
    };
  },

  setEnabledTools(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) throw new Error("Agent not found");
    const chatService = app.requireService(ChatService);
    const tools = chatService.setEnabledTools(args.tools, agent);
    return { tools };
  },

  enableTools(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) throw new Error("Agent not found");
    const chatService = app.requireService(ChatService);
    const tools = chatService.enableTools(args.tools, agent);
    return { tools };
  },

  disableTools(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) throw new Error("Agent not found");
    const chatService = app.requireService(ChatService);
    const tools = chatService.disableTools(args.tools, agent);
    return { tools };
  },

  getChatMessages(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) throw new Error("Agent not found");
    const chatService = app.requireService(ChatService);
    return {
      messages: chatService.getChatMessages(agent)
    };
  },

  clearChatMessages(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) throw new Error("Agent not found");
    const chatService = app.requireService(ChatService);
    chatService.clearChatMessages(agent);
    return { success: true };
  }
});
