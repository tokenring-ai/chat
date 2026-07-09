import type Agent from "@tokenring-ai/agent/Agent";
import { CommandFailedError } from "@tokenring-ai/agent/AgentError";
import type { InputAttachment } from "@tokenring-ai/agent/AgentEvents";
import { mimeTypeClassifications } from "@tokenring-ai/agent/AgentEvents";
import type { AgentCreationContext } from "@tokenring-ai/agent/types";
import type { ChatModelSpec } from "@tokenring-ai/ai-client/client/AIChatClient";
import { ChatModelRegistry, TranscriptionModelRegistry } from "@tokenring-ai/ai-client/ModelRegistry";
import { parseModelAndSettings } from "@tokenring-ai/ai-client/util/modelSettings";
import type TokenRingApp from "@tokenring-ai/app";
import type { TokenRingService } from "@tokenring-ai/app/types";
import { ConfigurationError } from "@tokenring-ai/app/types";
import { AgentLifecycleService } from "@tokenring-ai/lifecycle";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";
import interpolateString from "@tokenring-ai/utility/string/interpolateString";
import type { z } from "zod";
import { AfterChatClear, AfterChatCompaction } from "./lifecycle.ts";
import {
  ChatAgentConfigSchema,
  type ChatServiceConfigSchema,
  type ContextHandler,
  type ContextItem,
  type NamedTool,
  type ParsedChatConfig,
  type StoredChatCompaction,
  type StoredChatMessage,
  type TokenRingToolDefinition,
} from "./schema.ts";
import { ChatServiceState } from "./state/chatServiceState.ts";
import { tokenRingTool } from "./util/tokenRingTool.ts";

export type BuildChatMessagesOptions = {
  input: string;
  attachments?: InputAttachment[];
  chatConfig: ParsedChatConfig;
  agent: Agent;
};

export type ResolveAttachmentsOptions = {
  attachments?: InputAttachment[] | undefined;
  modelSpec: ChatModelSpec;
  allowRemoteAttachments?: boolean | undefined;
  agent: Agent;
};

export default class ChatService implements TokenRingService {
  readonly name = "ChatService";
  description = "A service for managing AI configuration";
  defaultModel: string | null = null;
  defaultTranscriptionModel: string | null = null;
  private tools = new KeyedRegistry<NamedTool>();
  requireTool = this.tools.require;
  registerTool = this.tools.set;
  getAvailableToolNames = this.tools.keysArray;
  getAvailableToolEntries = this.tools.entriesArray;

  getToolNamesLike = this.tools.keysLike;
  ensureToolNamesLike = this.tools.requireKeysLike;
  private contextHandlers = new KeyedRegistry<ContextHandler>();
  getContextHandlerByName = this.contextHandlers.get;
  requireContextHandlerByName = this.contextHandlers.require;
  registerContextHandler = this.contextHandlers.set;
  registerContextHandlers = this.contextHandlers.setAll;

  constructor(
    readonly app: TokenRingApp,
    readonly options: z.output<typeof ChatServiceConfigSchema>,
  ) {}

  start() {
    const chatModelRegistry = this.app.requireService(ChatModelRegistry);

    for (const modelName of this.options.defaultModels) {
      this.defaultModel = chatModelRegistry.getCheapestModelByRequirements(modelName);
      if (this.defaultModel) break;
    }

    if (this.defaultModel) {
      this.app.serviceOutput(this, `Selected ${this.defaultModel} as default model for chat`);
    } else {
      this.app.serviceError(this, `No default model was selected for chat`);
    }

    const transcriptionModelRegistry = this.app.requireService(TranscriptionModelRegistry);
    for (const modelName of this.options.defaultTranscriptionModels) {
      const matchedModels = Object.keys(transcriptionModelRegistry.getModelSpecsByRequirements(modelName));
      if (matchedModels[0]) {
        this.defaultTranscriptionModel = matchedModels[0];
        break;
      }
    }

    if (this.defaultTranscriptionModel) {
      this.app.serviceOutput(this, `Selected ${this.defaultTranscriptionModel} as default transcription model for chat`);
    } else if (this.options.defaultTranscriptionModels.length > 0) {
      this.app.serviceError(this, `No default transcription model was selected for chat`);
    }
  }

  attach(agent: Agent, creationContext: AgentCreationContext): void {
    const { enabledTools, hiddenTools, ...agentConfig } = deepClone(this.options.agentDefaults, agent.getAgentConfigSlice("chat", ChatAgentConfigSchema));

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

    const selectedTranscriptionModel = initialState.currentConfig.transcriptionModel ?? this.defaultTranscriptionModel;
    if (selectedTranscriptionModel) {
      creationContext.items.push(`Transcription Model: ${selectedTranscriptionModel}`);
    }
  }

  async buildChatMessages({ input, attachments, chatConfig, agent }: BuildChatMessagesOptions) {
    const lastMessage = this.getLastMessage(agent);

    let instructions: string;
    if (lastMessage?.instructions) {
      instructions = lastMessage.instructions;
    } else {
      const replacementFunctions = {
        DATE: () => new Date().toLocaleDateString(),
      } as Record<string, () => string>;

      instructions = interpolateString(chatConfig.systemPrompt, replacementFunctions);
    }

    const messages: ContextItem[] = [];

    for (const sourceConfig of lastMessage ? chatConfig.context.followUp : chatConfig.context.initial) {
      const handler = this.requireContextHandlerByName(sourceConfig.type);

      for await (const item of handler({
        input,
        ...(attachments?.length && { attachments }),
        chatConfig,
        sourceConfig,
        agent,
      })) {
        messages.push(item);
      }
    }
    return { messages, instructions };
  }

  addTools(...tools: TokenRingToolDefinition<any>[]) {
    for (const tool of tools) {
      // Check for duplicate tool registration
      if (this.tools.get(tool.name)) {
        throw new ConfigurationError(this.name, `Tool "${tool.name}" is already registered`);
      }

      this.tools.set(tool.name, tokenRingTool(tool));
    }
  }

  /**
   * Set model for the current agent
   */
  setModel(model: string, agent: Agent): void {
    this.updateChatConfig({ model }, agent);
  }

  getModel(agent: Agent): string | null {
    return this.getChatConfig(agent).model ?? this.defaultModel;
  }

  requireModel(agent: Agent): string {
    const model = this.getChatConfig(agent).model ?? this.defaultModel;
    if (!model) throw new ConfigurationError(this.name, `No model selected`);
    return model;
  }

  getModelAndSettings(agent: Agent) {
    const currentModel = this.requireModel(agent);
    return { currentModel, ...parseModelAndSettings(currentModel) };
  }

  /**
   * Set transcription model for the current agent
   */
  setTranscriptionModel(transcriptionModel: string, agent: Agent): void {
    this.updateChatConfig({ transcriptionModel }, agent);
  }

  getTranscriptionModel(agent: Agent): string | null {
    return this.getChatConfig(agent).transcriptionModel ?? this.defaultTranscriptionModel;
  }

  requireTranscriptionModel(agent: Agent): string {
    const model = this.getTranscriptionModel(agent);
    if (!model) throw new CommandFailedError(`No transcription model selected`);
    return model;
  }

  /**
   * When the chat model does not support audio input, replace audio attachments with text transcripts
   * produced by the selected transcription model.
   */
  async resolveAttachmentsForModel({
    attachments,
    modelSpec,
    allowRemoteAttachments = true,
    agent,
  }: ResolveAttachmentsOptions): Promise<InputAttachment[] | undefined> {
    if (!attachments?.length) return attachments;

    const hasUnsupportedAttachments = attachments.some(attachment => !modelSpec.inputCapabilities.includes(attachment.mimeType));
    if (!hasUnsupportedAttachments) return attachments;

    // TODO: This can happen in parallel, but we might want to limit the number of concurrent transcodings
    return await Promise.all(
      attachments.map(async attachment => {
        if (modelSpec.inputCapabilities.includes(attachment.mimeType)) {
          return attachment;
        }

        const mimeTypeClassification = mimeTypeClassifications.get(attachment.mimeType);
        switch (mimeTypeClassification) {
          case "audio":
            return await this.transcodeAudioAttachment(attachment, agent, allowRemoteAttachments);
          default:
            throw new CommandFailedError(`Attachment "${attachment.name}" has unsupported mime type ${attachment.mimeType} and cannot be transcoded`);
        }
      }),
    );
  }

  async transcodeAudioAttachment(attachment: InputAttachment, agent: Agent, allowRemoteAttachments: boolean): Promise<InputAttachment> {
    const transcriptionModel = this.requireTranscriptionModel(agent);
    const transcriptionModelRegistry = agent.requireServiceByType(TranscriptionModelRegistry);
    const transcriptionClient = transcriptionModelRegistry.getClient(transcriptionModel);

    let audio: string | URL | Buffer;
    switch (attachment.encoding) {
      case "base64":
        audio = attachment.body;
        break;
      case "href":
        if (!allowRemoteAttachments) {
          throw new CommandFailedError(`Remote audio attachments are not allowed (${attachment.name})`);
        }
        audio = new URL(attachment.body);
        break;
      case "text":
        throw new CommandFailedError(`Audio attachment "${attachment.name}" cannot use text encoding; use base64 or href`);
      default: {
        const exhaustive: any = attachment.encoding satisfies never;
        throw new CommandFailedError(`Unsupported attachment encoding: ${exhaustive}`);
      }
    }

    agent.infoMessage(`Transcribing audio attachment "${attachment.name}" with ${transcriptionModel} (chat model does not support this attachment type)`);
    const [transcript] = await agent.busyWithActivity(`Transcribing ${attachment.name}...`, transcriptionClient.transcribe({ audio }, agent));

    return {
      ...attachment,
      encoding: "text",
      mimeType: "text/plain",
      body: transcript,
      description: attachment.description ?? `Transcript of audio attachment ${attachment.name}`,
    };
  }

  getChatConfig(agent: Agent): ParsedChatConfig {
    return agent.getState(ChatServiceState).currentConfig;
  }

  updateChatConfig(aiConfig: Partial<ParsedChatConfig>, agent: Agent): void {
    agent.mutateState(ChatServiceState, state => {
      state.currentConfig = { ...state.currentConfig, ...aiConfig };
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
      return messages[messages.length - 1]!;
    }
    return null;
  }

  /**
   * Pushes a message onto the chat history, moving the previous current message to history if it exists.
   * This allows for maintaining a stack of messages for undo/redo operations.
   *
   */
  pushChatMessage(message: StoredChatMessage, agent: Agent): void {
    agent.mutateState(ChatServiceState, state => {
      state.messages = [...state.messages, message];
    });
  }

  /**
   * Clears all chat messages from the given agent's state.
   *
   * @param {Agent} agent - The agent instance whose chat messages will be cleared.
   * @return {void} This method does not return a value.
   */
  async clearChatMessages(agent: Agent): Promise<void> {
    agent.mutateState(ChatServiceState, state => {
      state.messages = [];
      state.pendingCompaction = null;
      state.compactionInProgress = false;
    });

    await agent.getServiceByType(AgentLifecycleService)?.executeHooks(new AfterChatClear(), agent);
  }

  /**
   * Restores the most recent message from history as the current message.
   * This provides undo functionality by popping the last message from the history stack.
   *
   */
  popMessage(agent: Agent): void {
    agent.mutateState(ChatServiceState, state => {
      if (state.messages.length > 0) {
        state.messages = state.messages.slice(0, state.messages.length - 1);
      }
    });
  }

  getEnabledTools(agent: Agent): string[] {
    return agent.getState(ChatServiceState).currentConfig.enabledTools;
  }

  getHiddenTools(agent: Agent): string[] {
    return agent.getState(ChatServiceState).currentConfig.hiddenTools;
  }

  setEnabledTools(toolNames: string[], agent: Agent): string[] {
    const matchedToolNames = toolNames.flatMap(toolName => this.tools.requireKeysLike(toolName));

    return agent.mutateState(ChatServiceState, state => {
      state.currentConfig.enabledTools = matchedToolNames;
      return state.currentConfig.enabledTools;
    });
  }

  enableTools(toolNames: string[], agent: Agent): string[] {
    const matchedToolNames = toolNames.flatMap(toolName => this.tools.requireKeysLike(toolName));

    return agent.mutateState(ChatServiceState, state => {
      const newTools = new Set(state.currentConfig.enabledTools);
      matchedToolNames.forEach(tool => {
        newTools.add(tool);
      });
      state.currentConfig.enabledTools = Array.from(newTools.values());

      return state.currentConfig.enabledTools;
    });
  }

  disableTools(toolNames: string[], agent: Agent): string[] {
    const matchedToolNames = toolNames.flatMap(toolName => this.tools.requireKeysLike(toolName));

    return agent.mutateState(ChatServiceState, state => {
      const newTools = new Set(state.currentConfig.enabledTools);
      matchedToolNames.forEach(tool => {
        newTools.delete(tool);
      });
      state.currentConfig.enabledTools = Array.from(newTools.values());

      return state.currentConfig.enabledTools;
    });
  }

  hideTools(toolNames: string[], agent: Agent): string[] {
    const matchedToolNames = toolNames.flatMap(toolName => this.tools.requireKeysLike(toolName));
    return agent.mutateState(ChatServiceState, state => {
      const newTools = new Set(state.currentConfig.enabledTools);
      matchedToolNames.forEach(tool => {
        newTools.delete(tool);
      });
      state.currentConfig.enabledTools = Array.from(newTools.values());

      const newHiddenTools = new Set(state.currentConfig.hiddenTools);
      matchedToolNames.forEach(tool => {
        newHiddenTools.add(tool);
      });
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
    return agent.mutateState(ChatServiceState, state => {
      const pendingCompaction = state.pendingCompaction;
      const lastMessage = state.messages.at(-1);

      if (!pendingCompaction || !lastMessage) {
        return false;
      }

      if (lastMessage.messages.length < pendingCompaction.endIndex) {
        agent.warningMessage("Skipping stored compaction because the prior message stream no longer matches the recorded span");
        state.pendingCompaction = null;
        return false;
      }

      lastMessage.messages = [
        ...lastMessage.messages.slice(0, pendingCompaction.startIndex),
        ...pendingCompaction.messages,
        ...lastMessage.messages.slice(pendingCompaction.endIndex),
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

    //const systemMessages = lastMessage.request.messages.filter(message => message.role === "system");
    const priorMessageStream = [...lastMessage.messages, ...(lastMessage.response.messages ?? [])];

    if (priorMessageStream.length === 0) return false;

    agent.mutateState(ChatServiceState, state => {
      state.compactionInProgress = true;
    });

    try {
      const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);
      const client = chatModelRegistry.getClient(this.requireModel(agent));

      const response = await agent.busyWithActivity(
        "Waiting for response from AI...",
        client.streamChat(
          {
            instructions: lastMessage.instructions,
            messages: [
              ...priorMessageStream,
              {
                role: "user",
                content: `
Please provide a long and detailed and comprehensive summary of the prior conversation, focusing on the following:

${compactionConfig.focus}
`.trim(),
              },
            ],
            tools: {},
          },
          agent,
        ),
      );

      agent.mutateState(ChatServiceState, state => {
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
      agent.mutateState(ChatServiceState, state => {
        state.compactionInProgress = false;
      });
    }
  }

  async compactContext(compactionConfig: ParsedChatConfig["compaction"], agent: Agent): Promise<void> {
    const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);

    const previousMessages = this.getChatMessages(agent);
    if (previousMessages.length === 0) return;

    const { instructions, messages } = await this.buildChatMessages({
      input: `
Please provide a long and detailed and comprehensive summary of the prior conversation, focusing on the following:

${compactionConfig.focus}
`.trim(),
      chatConfig: this.getChatConfig(agent),
      agent,
    });

    const client = chatModelRegistry.getClient(this.requireModel(agent));

    const response = await agent.busyWithActivity(
      "Waiting for response from AI...",
      client.streamChat(
        {
          instructions,
          messages,
          tools: {},
        },
        agent,
      ),
    );

    await this.clearChatMessages(agent);

    // Update the current message to follow up to the previous
    this.pushChatMessage(
      {
        instructions,
        messages,
        response,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      agent,
    );

    await agent.getServiceByType(AgentLifecycleService)?.executeHooks(new AfterChatCompaction(), agent);

    agent.infoMessage("Context compacted successfully");
  }
}
