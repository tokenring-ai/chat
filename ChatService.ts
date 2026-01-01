import Agent from "@tokenring-ai/agent/Agent";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";
import {TokenRingService} from "@tokenring-ai/app/types";
import deepMerge from "@tokenring-ai/utility/object/deepMerge";
import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";
import {z} from "zod";
import {ChatServiceState} from "./state/chatServiceState.js";
import {
  ChatServiceConfigSchema,
  ChatConfig,
  ChatAgentConfigSchema,
  ContextHandler, ContextItem,
  NamedTool,
  StoredChatMessage,
  TokenRingToolDefinition
} from "./schema.ts";
import {tokenRingTool} from "./util/tokenRingTool.ts";
import TokenRingApp from "@tokenring-ai/app";

export type ChatServiceOptions = {
  model: string;
};

export default class ChatService implements TokenRingService {
  name = "ChatService";
  description = "A service for managing AI configuration";

  private tools = new KeyedRegistry<NamedTool>();
  private contextHandlers = new KeyedRegistry<ContextHandler>();

  requireTool = this.tools.requireItemByName;
  registerTool = this.tools.register;
  getAvailableToolNames = this.tools.getAllItemNames;

  getToolNamesLike = this.tools.getItemNamesLike;
  ensureToolNamesLike = this.tools.ensureItemNamesLike;

  getContextHandlerByName = this.contextHandlers.getItemByName;
  requireContextHandlerByName = this.contextHandlers.requireItemByName;
  registerContextHandler = this.contextHandlers.register;
  registerContextHandlers = this.contextHandlers.registerAll;

  constructor(readonly app: TokenRingApp, readonly options: z.output<typeof ChatServiceConfigSchema>) {}

  async attach(agent: Agent): Promise<void> {
    let { enabledTools, ...agentConfig} = deepMerge(this.options.agentDefaults, agent.getAgentConfigSlice('chat', ChatAgentConfigSchema));

    const chatModelRegistry = this.app.requireService(ChatModelRegistry);

    if (agentConfig.model === 'auto') {
      let autoSelectedModel : string | null = null;
      for (const modelName of this.options.defaultModels) {
        autoSelectedModel = chatModelRegistry.getCheapestModelByRequirements({nameLike: modelName});
        if (autoSelectedModel) break;
      }

      if (autoSelectedModel) {
        agent.infoLine(`Auto-selected model ${autoSelectedModel} for chat`);
        agentConfig.model = autoSelectedModel;
      } else {
        agent.warningLine(`The model for the agent was set to auto, and none of the default models appear to be available for chat, please manually select a model with /model`);
      }
    } else {
      const selectedModel = chatModelRegistry.getCheapestModelByRequirements({nameLike: agentConfig.model});
      if (selectedModel) {
        agent.infoLine(`Using model ${agentConfig.model} for chat`);
      } else {
        agent.warningLine(`The model ${agentConfig.model} is currently selected for chat, but it is not available. Please manually select a new model with /model`);
      }
    }

    // The enabled tools can include wildcards, so they need to be mapped to actual tool names with ensureItemNamesLike
    agent.initializeState(ChatServiceState, {
      ...agentConfig,
      enabledTools: enabledTools.map(toolName => this.tools.ensureItemNamesLike(toolName)).flat()
    });
  }

  async buildChatMessages(input: string, chatConfig: ChatConfig, agent: Agent) {
    const lastMessage = this.getLastMessage(agent);

    const messages: ContextItem[] = [];

    for (const source of lastMessage ? chatConfig.context.followUp : chatConfig.context.initial) {
      const handler = this.requireContextHandlerByName(source.type);

      for await (const item of handler(input, chatConfig, source, agent)) {
        messages.push(item);
      }
    }
    return messages;
  }

  addTools(
    pkgName: string,
    tools: Record<string, TokenRingToolDefinition<any>>,
  ) {
    for (const toolName in tools) {
      const fullName = `${pkgName}/${toolName}`;

      // Check for duplicate tool registration
      if (this.tools.getItemByName(fullName)) {
        throw new Error(`Tool "${fullName}" is already registered`);
      }

      this.tools.register(
        fullName,
        tokenRingTool({...tools[toolName]}),
      );
    }
  }

  /**
   * Set model for the current agent
   */
  setModel(model: string, agent: Agent): void {
    this.updateChatConfig({model}, agent);
  }

  getModel(agent: Agent): string | null {
    return this.getChatConfig(agent).model ?? null;
  }

  requireModel(agent: Agent): string {
    const model = this.getChatConfig(agent).model;
    if (! model) throw new Error(`No model selected`);
    return model;
  }

  getChatConfig(agent: Agent): ChatConfig {
    return agent.getState(ChatServiceState).currentConfig;
  }

  updateChatConfig(aiConfig: Partial<ChatConfig>, agent: Agent): void {
    agent.mutateState(ChatServiceState, (state) => {
      state.currentConfig = {...state.currentConfig, ...aiConfig};
    });
  }

  /**
   * Gets the chat messages.
   */
  getChatMessages(agent: Agent): StoredChatMessage[] {
    return agent.getState(ChatServiceState).messages;
  }

  /**
   * Gets the current active message.
   */
  getLastMessage(agent: Agent): StoredChatMessage | null {
    const messages = this.getChatMessages(agent);
    if (messages.length > 0) {
      return messages[messages.length - 1];
    }
    return null;
  }

  /**
   * Pushes a message onto the chat history, moving the previous current message to history if it exists.
   * This allows for maintaining a stack of messages for undo/redo operations.
   *
   */
  pushChatMessage(message: StoredChatMessage, agent: Agent): void {
    agent.mutateState(ChatServiceState, (state) => {
      state.messages = [...state.messages, message];
    });
  }

  /**
   * Clears all chat messages from the given agent's state.
   *
   * @param {Agent} agent - The agent instance whose chat messages will be cleared.
   * @return {void} This method does not return a value.
   */
  clearChatMessages(agent: Agent): void {
    agent.mutateState(ChatServiceState, (state) => {
      state.messages = [];
    });
  }

  /**
   * Restores the most recent message from history as the current message.
   * This provides undo functionality by popping the last message from the history stack.
   *
   */
  popMessage(agent: Agent): void {
    agent.mutateState(ChatServiceState, (state) => {
      if (state.messages.length > 0) {
        state.messages = state.messages.slice(0, state.messages.length - 1);
      }
    });
  }

  getEnabledTools(agent: Agent): string[] {
    return agent.getState(ChatServiceState).currentConfig.enabledTools ?? [];
  }

  setEnabledTools(toolNames: string[], agent: Agent): string[] {
    const matchedToolNames = toolNames.map(toolName => this.tools.ensureItemNamesLike(toolName)).flat();

    return agent.mutateState(ChatServiceState, (state) => {
      state.currentConfig.enabledTools = matchedToolNames;
      return state.currentConfig.enabledTools;
    })
  }

  enableTools(toolNames: string[], agent: Agent): string[] {
    const matchedToolNames = toolNames.map(toolName => this.tools.ensureItemNamesLike(toolName)).flat();

    return agent.mutateState(ChatServiceState, (state) => {
      const newTools = new Set(state.currentConfig.enabledTools);
      matchedToolNames.forEach(tool => newTools.add(tool));
      state.currentConfig.enabledTools = Array.from(newTools.values());

      return state.currentConfig.enabledTools;
    })
  }

  disableTools(toolNames: string[], agent: Agent): string[] {
    const matchedToolNames = toolNames.map(toolName => this.tools.ensureItemNamesLike(toolName)).flat();

    return agent.mutateState(ChatServiceState, (state) => {
      const newTools = new Set(state.currentConfig.enabledTools);
      matchedToolNames.forEach(tool => newTools.delete(tool));
      state.currentConfig.enabledTools = Array.from(newTools.values());

      return state.currentConfig.enabledTools;
    });
  }
}
