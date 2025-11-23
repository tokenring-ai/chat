import Agent from "@tokenring-ai/agent/Agent";
import type {AIResponse, ChatRequest} from "@tokenring-ai/ai-client/client/AIChatClient";
import {TokenRingService} from "@tokenring-ai/app/types";
import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";
import {ChatServiceState} from "./state/chatServiceState.js";
import {NamedTool, TokenRingToolDefinition} from "./types.ts";
import {tokenRingTool} from "./util/tokenRingTool.ts";

import {z} from "zod";

export const ChatConfigSchema = z.object({
  model: z.string().optional(),
  systemPrompt: z.union([z.string(), z.function({output: z.string()})]),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  topP: z.number().optional(),
  topK: z.number().optional(),
  frequencyPenalty: z.number().optional(),
  presencePenalty: z.number().optional(),
  stopSequences: z.array(z.string()).optional(),
  autoCompact: z.boolean().optional(),
  enabledTools: z.array(z.string()).optional(),
});

export type ChatConfig = z.infer<typeof ChatConfigSchema>;

/**
 * Represents a chat message in the storage system
 */
export interface StoredChatMessage {
  /** The AI request */
  request: ChatRequest;
  /** The response from AI */
  response: AIResponse;
  /** The creation time in milliseconds since the epoch format */
  createdAt: number;
  /** The update time in milliseconds since the epoch format */
  updatedAt: number;
}

export type ChatServiceOptions = {
  model: string;
};

export default class ChatService implements TokenRingService {
  name = "ChatService";
  description = "A service for managing AI configuration";
  model: string;

  private tools = new KeyedRegistry<NamedTool>();

  requireTool = this.tools.requireItemByName;
  registerTool = this.tools.register;
  getAvailableToolNames = this.tools.getAllItemNames;

  getToolNamesLike = this.tools.getItemNamesLike;
  ensureToolNamesLike = this.tools.ensureItemNamesLike;

  constructor(options: ChatServiceOptions) {
    this.model = options.model;
  }

  async attach(agent: Agent): Promise<void> {
    agent.initializeState(ChatServiceState, agent.getAgentConfigSlice('chat', ChatConfigSchema));
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

  getModel(agent: Agent): string {
    return this.getChatConfig(agent).model ?? this.model;
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
  getCurrentMessage(agent: Agent): StoredChatMessage | null {
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

  setEnabledTools(toolNames: string[], agent: Agent): void {
    this.tools.ensureItems(toolNames);

    agent.mutateState(ChatServiceState, (state) => {
      state.currentConfig.enabledTools = toolNames;
    })
  }

  enableTools(toolNames: string[], agent: Agent): void {
    this.tools.ensureItems(toolNames);

    agent.mutateState(ChatServiceState, (state) => {
      state.currentConfig.enabledTools ??= [];
      for (const tool of toolNames) {
        if (!state.currentConfig.enabledTools.includes(tool)) {
          state.currentConfig.enabledTools.push(tool);
        }
      }
    })
  }

  disableTools(toolNames: string[], agent: Agent): void {
    this.tools.ensureItems(toolNames);
    agent.mutateState(ChatServiceState, (state) => {
      state.currentConfig.enabledTools = (state.currentConfig.enabledTools ?? [])
        .filter((tool) =>
          toolNames.includes(tool)
        )
    });
  }
}
