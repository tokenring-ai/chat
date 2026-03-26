import Agent from "@tokenring-ai/agent/Agent";
import {InputAttachment} from "@tokenring-ai/agent/AgentEvents";
import type {AgentCreationContext} from "@tokenring-ai/agent/types";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";
import {getModelAndSettings} from "@tokenring-ai/ai-client/util/modelSettings";
import TokenRingApp from "@tokenring-ai/app";
import {TokenRingService} from "@tokenring-ai/app/types";
import {AgentLifecycleService} from "@tokenring-ai/lifecycle";
import deepMerge from "@tokenring-ai/utility/object/deepMerge";
import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";
import {z} from "zod";
import {AfterChatClear, AfterChatCompaction} from "./lifecycle.ts";
import {
  ChatAgentConfigSchema,
  ChatServiceConfigSchema,
  ContextHandler,
  ContextItem,
  NamedTool,
  ParsedChatConfig,
  StoredChatCompaction,
  StoredChatMessage,
  TokenRingToolDefinition
} from "./schema.ts";
import {ChatServiceState} from "./state/chatServiceState.js";
import {tokenRingTool} from "./util/tokenRingTool.ts";

export type BuildChatMessagesOptions = {
  input: string;
  attachments?: InputAttachment[];
  chatConfig: ParsedChatConfig;
  agent: Agent;
};

export default class ChatService implements TokenRingService {
  readonly name = "ChatService";
  description = "A service for managing AI configuration";

  private tools = new KeyedRegistry<NamedTool>();
  private contextHandlers = new KeyedRegistry<ContextHandler>();

  requireTool = this.tools.requireItemByName;
  registerTool = this.tools.register;
  getAvailableToolNames = this.tools.getAllItemNames;
  getAvailableToolEntries = this.tools.entries;

  getToolNamesLike = this.tools.getItemNamesLike;
  ensureToolNamesLike = this.tools.ensureItemNamesLike;

  getContextHandlerByName = this.contextHandlers.getItemByName;
  requireContextHandlerByName = this.contextHandlers.requireItemByName;
  registerContextHandler = this.contextHandlers.register;
  registerContextHandlers = this.contextHandlers.registerAll;

  defaultModel: string | null = null;

  constructor(readonly app: TokenRingApp, readonly options: z.output<typeof ChatServiceConfigSchema>) {
  }

  start() {
    const chatModelRegistry = this.app.requireService(ChatModelRegistry);

    for (const modelName of this.options.defaultModels) {
      this.defaultModel = chatModelRegistry.getCheapestModelByRequirements(modelName);
      if (this.defaultModel) break;
    }

    if (this.defaultModel) {
      this.app.serviceOutput(this, `Selected ${this.defaultModel} as default model for chat`);
    } else {
      this.app.serviceError(this, `No default model was selected for chat'`);
    }
  }

  attach(agent: Agent, creationContext: AgentCreationContext): void {
    let {enabledTools, hiddenTools, ...agentConfig} = deepMerge(this.options.agentDefaults, agent.getAgentConfigSlice('chat', ChatAgentConfigSchema));

    // The enabled tools can include wildcards, so they need to be mapped to actual tool names with ensureItemNamesLike
    const initialState = agent.initializeState(ChatServiceState, {
      ...agentConfig,
      enabledTools: [],
      hiddenTools: [],
    });

    this.hideTools(hiddenTools, agent);
    this.enableTools(enabledTools, agent);

    const selectedModel = initialState.currentConfig.model ?? this.defaultModel;
    if (selectedModel) {
      creationContext.items.push(`Chat Model: ${selectedModel}`);
    } else {
      creationContext.items.push(`Chat Model: No model selected`);
      agent.warningMessage(`No model was selected for chat, please manually select a model with /model`);
    }
  }

  async buildChatMessages({input, attachments, chatConfig, agent}: BuildChatMessagesOptions) {
    const lastMessage = this.getLastMessage(agent);

    const messages: ContextItem[] = [];

    for (const sourceConfig of lastMessage ? chatConfig.context.followUp : chatConfig.context.initial) {
      const handler = this.requireContextHandlerByName(sourceConfig.type);

      for await (const item of handler({input, attachments, chatConfig, sourceConfig, agent})) {
        messages.push(item);
      }
    }
    return messages;
  }

  addTools(
    tools: Record<string, TokenRingToolDefinition<any>>,
  ) {
    for (const tool of Object.values(tools)) {
      // Check for duplicate tool registration
      if (this.tools.getItemByName(tool.name)) {
        throw new Error(`Tool "${tool.name}" is already registered`);
      }

      this.tools.register(
        tool.name,
        tokenRingTool(tool)
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
    return this.getChatConfig(agent).model ?? this.defaultModel;
  }

  requireModel(agent: Agent): string {
    const model = this.getChatConfig(agent).model ?? this.defaultModel;
    if (!model) throw new Error(`No model selected`);
    return model;
  }

  getModelAndSettings(agent: Agent) {
    return getModelAndSettings(this, agent);
  }

  getChatConfig(agent: Agent): ParsedChatConfig {
    return agent.getState(ChatServiceState).currentConfig;
  }

  updateChatConfig(aiConfig: Partial<ParsedChatConfig>, agent: Agent): void {
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
      state.pendingCompaction = null;
      state.compactionInProgress = false;
    });

    agent.getServiceByType(AgentLifecycleService)?.executeHooks(new AfterChatClear(), agent);
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

  getHiddenTools(agent: Agent): string[] {
    return agent.getState(ChatServiceState).currentConfig.hiddenTools ?? [];
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

  hideTools(toolNames: string[], agent: Agent): string[] {
    const matchedToolNames = toolNames.map(toolName => this.tools.ensureItemNamesLike(toolName)).flat();
    return agent.mutateState(ChatServiceState, (state) => {
      const newTools = new Set(state.currentConfig.enabledTools);
      matchedToolNames.forEach(tool => newTools.delete(tool));
      state.currentConfig.enabledTools = Array.from(newTools.values());

      const newHiddenTools = new Set(state.currentConfig.hiddenTools);
      matchedToolNames.forEach(tool => newHiddenTools.add(tool));
      state.currentConfig.hiddenTools = Array.from(newHiddenTools.values());
      return state.currentConfig.hiddenTools;
    });
  }

  getPendingCompaction(agent: Agent): StoredChatCompaction | null {
    return agent.getState(ChatServiceState).pendingCompaction;
  }

  hasPendingCompaction(agent: Agent): boolean {
    return this.getPendingCompaction(agent) !== null;
  }

  isCompactionInProgress(agent: Agent): boolean {
    return agent.getState(ChatServiceState).compactionInProgress;
  }

  applyPendingCompaction(agent: Agent): boolean {
    return agent.mutateState(ChatServiceState, (state) => {
      const pendingCompaction = state.pendingCompaction;
      const lastMessage = state.messages.at(-1);

      if (!pendingCompaction || !lastMessage) {
        return false;
      }

      if (lastMessage.request.messages.length < pendingCompaction.endIndex) {
        agent.warningMessage("Skipping stored compaction because the prior message stream no longer matches the recorded span");
        state.pendingCompaction = null;
        return false;
      }

      lastMessage.request.messages = [
        ...lastMessage.request.messages.slice(0, pendingCompaction.startIndex),
        ...pendingCompaction.messages,
        ...lastMessage.request.messages.slice(pendingCompaction.endIndex),
      ];
      lastMessage.updatedAt = Date.now();
      state.pendingCompaction = null;
      return true;
    });
  }

  async stageContextCompaction(compactionConfig: ParsedChatConfig["compaction"], agent: Agent): Promise<boolean> {
    const currentState = agent.getState(ChatServiceState);
    if (currentState.compactionInProgress || currentState.pendingCompaction) {
      return false;
    }

    const lastMessage = this.getLastMessage(agent);
    if (!lastMessage) return false;

    const systemMessages = lastMessage.request.messages.filter((message) => message.role === "system");
    const priorMessageStream = [
      ...lastMessage.request.messages,
      ...(lastMessage.response.messages ?? []),
    ];

    if (priorMessageStream.length === 0) return false;

    agent.mutateState(ChatServiceState, (state) => {
      state.compactionInProgress = true;
    });

    try {
      const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);
      const client = await chatModelRegistry.getClient(this.requireModel(agent));

      const response = await agent.busyWithActivity(
        "Waiting for response from AI...",
        client.streamChat({
          messages: [
            ...systemMessages,
            ...priorMessageStream,
            {
              role: "user",
              content: `
Please provide a long and detailed and comprehensive summary of the prior conversation, focusing on the following:

${compactionConfig.focus}
`.trim(),
            },
          ],
          tools: {}
        }, agent),
      );

      agent.mutateState(ChatServiceState, (state) => {
        state.pendingCompaction = {
          startIndex: 0,
          endIndex: priorMessageStream.length,
          messages: response.messages ?? [],
          createdAt: Date.now(),
        };
      });

      agent.infoMessage("Context compaction prepared and stored for later application");
      return true;
    } finally {
      agent.mutateState(ChatServiceState, (state) => {
        state.compactionInProgress = false;
      });
    }
  }

  async compactContext(compactionConfig: ParsedChatConfig["compaction"], agent: Agent): Promise<void> {
    const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);

    const messages = this.getChatMessages(agent);
    if (messages.length === 0) return;

    const requestMessages = await this.buildChatMessages({
      input: `
Please provide a long and detailed and comprehensive summary of the prior conversation, focusing on the following:

${compactionConfig.focus}
`.trim(),
      chatConfig: this.getChatConfig(agent),
      agent
    });

    const client = await chatModelRegistry.getClient(
      this.requireModel(agent),
    );

    const response = await agent.busyWithActivity(
      "Waiting for response from AI...",
      client.streamChat({
        messages: requestMessages,
        tools: {}
      }, agent),
    );

    this.clearChatMessages(agent);

    // Update the current message to follow up to the previous
    this.pushChatMessage(
      {
        request: {
          messages: requestMessages.filter(
            (message) => message.role === "system",
          ),
        },
        response,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      agent,
    );


    agent.getServiceByType(AgentLifecycleService)?.executeHooks(new AfterChatCompaction(), agent);
    agent.infoMessage("Context compacted successfully");
  }

}
