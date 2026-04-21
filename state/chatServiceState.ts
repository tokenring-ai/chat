import { AgentStateSlice } from "@tokenring-ai/agent/types";
import markdownList from "@tokenring-ai/utility/string/markdownList";
import async from "async";
import { z } from "zod";
import { ChatConfigMergedSchema, type ParsedChatConfig, StoredChatCompactionSchema, type StoredChatMessage } from "../schema.ts";

const serializationSchema = z.object({
  currentConfig: ChatConfigMergedSchema,
  injectedMessages: z.array(z.string()).default([]),
  messages: z.array(z.any()),
  pendingCompaction: StoredChatCompactionSchema.nullable().default(null),
  compactionInProgress: z.boolean().default(false),
});

export class ChatServiceState extends AgentStateSlice<typeof serializationSchema> {
  currentConfig: ParsedChatConfig;
  parallelTools = false;
  toolQueue = async.queue(async (task: () => Promise<object>) => task(), 1);
  /** History of chat messages */
  injectedMessages: string[] = [];
  messages: StoredChatMessage[] = [];
  pendingCompaction: z.output<typeof StoredChatCompactionSchema> | null = null;
  compactionInProgress = false;

  constructor(readonly initialConfig: ParsedChatConfig) {
    super("ChatServiceState", serializationSchema);
    this.currentConfig = { ...initialConfig };
  }

  async runToolMaybeInParallel<T extends object>(executeToolFunction: () => Promise<T>): Promise<T> {
    if (this.parallelTools) {
      return await executeToolFunction();
    } else {
      return await this.toolQueue.push(executeToolFunction);
    }
  }

  resetSettings(): void {
    this.currentConfig = { ...this.initialConfig };
  }

  serialize(): z.output<typeof serializationSchema> {
    return {
      currentConfig: this.currentConfig,
      injectedMessages: this.injectedMessages,
      messages: this.messages,
      pendingCompaction: this.pendingCompaction,
      compactionInProgress: this.compactionInProgress,
    };
  }

  deserialize(data: z.output<typeof serializationSchema>): void {
    this.currentConfig = data.currentConfig || { ...this.initialConfig };
    this.injectedMessages = data.injectedMessages || [];
    this.messages = data.messages || [];
    this.pendingCompaction = data.pendingCompaction ?? null;
    this.compactionInProgress = data.compactionInProgress ?? false;
  }

  show(): string {
    return `Messages: ${this.messages.length}
${markdownList([
  `Enabled Tools: ${this.currentConfig.enabledTools?.join(", ") || "None"}`,
  `Compaction Policy: ${this.currentConfig.compaction.policy}`,
  `Compaction Threshold: ${this.currentConfig.compaction.compactionThreshold}`,
  `Compaction Apply Threshold: ${this.currentConfig.compaction.applyThreshold}`,
  `Pending Compaction: ${this.pendingCompaction ? "Yes" : "No"}`,
  `Max Steps: ${this.currentConfig.maxSteps}`,
  `System Prompt: ${this.currentConfig.systemPrompt}`,
])}`;
  }
}
