import { AgentStateSlice } from "@tokenring-ai/agent/types";
import type { AIResponseCost } from "@tokenring-ai/ai-client/schema.client";
import { AIResponseCostSchema, LanguageModelUsageSchema } from "@tokenring-ai/ai-client/schema.client";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import markdownList from "@tokenring-ai/utility/string/markdownList";
import async from "async";
import { z } from "zod";
import { ChatConfigMergedSchema, type ParsedChatConfig, StoredChatCompactionSchema, type StoredChatMessage, StoredChatMessageSchema } from "../schema.ts";

const serializationSchema = z.object({
  currentConfig: ChatConfigMergedSchema,
  injectedMessages: z.array(z.string()).default([]),
  messages: z.array(StoredChatMessageSchema),
  pendingCompaction: StoredChatCompactionSchema.nullable().default(null),
  compactionInProgress: z.boolean().default(false),
  contextLength: z.number().default(0),
  lastStepUsage: LanguageModelUsageSchema.exactOptional(),
  totalUsage: LanguageModelUsageSchema.prefault({}),
  totalCosts: AIResponseCostSchema.prefault({}),
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
  contextLength = 0;
  lastStepUsage = LanguageModelUsageSchema.parse({});
  totalUsage = LanguageModelUsageSchema.parse({});
  totalCosts: AIResponseCost = {
    input: 0,
    output: 0,
    cachedInput: 0,
    reasoning: 0,
    total: 0,
  };

  constructor(readonly initialConfig: ParsedChatConfig) {
    super("ChatServiceState", serializationSchema);
    this.currentConfig = deepClone(initialConfig);
  }

  async runToolMaybeInParallel<T extends object>(executeToolFunction: () => Promise<T>): Promise<T> {
    if (this.parallelTools) {
      return await executeToolFunction();
    } else {
      return await this.toolQueue.push(executeToolFunction);
    }
  }

  serialize(): z.output<typeof serializationSchema> {
    return {
      currentConfig: this.currentConfig,
      injectedMessages: this.injectedMessages,
      messages: this.messages,
      pendingCompaction: this.pendingCompaction,
      compactionInProgress: this.compactionInProgress,
      contextLength: this.contextLength,
      lastStepUsage: this.lastStepUsage,
      totalUsage: this.totalUsage,
      totalCosts: this.totalCosts,
    };
  }

  deserialize(data: z.output<typeof serializationSchema>): void {
    this.currentConfig = data.currentConfig;
    this.injectedMessages = data.injectedMessages;
    this.messages = data.messages;
    this.pendingCompaction = data.pendingCompaction;
    this.compactionInProgress = data.compactionInProgress;
  }

  addCosts(costs: AIResponseCost) {
    this.totalCosts.input += costs.input;
    this.totalCosts.output += costs.output;
    this.totalCosts.cachedInput += costs.cachedInput;
    this.totalCosts.reasoning += costs.reasoning;
    this.totalCosts.total += costs.total;
  }

  addUsage(usage: z.infer<typeof LanguageModelUsageSchema>) {
    this.lastStepUsage = usage;
    this.totalUsage = {
      totalTokens: this.totalUsage.totalTokens + usage.totalTokens,
      inputTokens: this.totalUsage.inputTokens + usage.inputTokens,
      inputTokenDetails: {
        noCacheTokens: this.totalUsage.inputTokenDetails.noCacheTokens + usage.inputTokenDetails.noCacheTokens,
        cacheReadTokens: this.totalUsage.inputTokenDetails.cacheReadTokens + usage.inputTokenDetails.cacheReadTokens,
        cacheWriteTokens: this.totalUsage.inputTokenDetails.cacheWriteTokens + usage.inputTokenDetails.cacheWriteTokens,
      },
      outputTokens: this.totalUsage.outputTokens + usage.outputTokens,
      outputTokenDetails: {
        textTokens: this.totalUsage.outputTokenDetails.textTokens + usage.outputTokenDetails.textTokens,
        reasoningTokens: this.totalUsage.outputTokenDetails.reasoningTokens + usage.outputTokenDetails.reasoningTokens,
      },
    };
  }

  show(): string {
    return `Messages: ${this.messages.length}
${markdownList([
  `Enabled Tools: ${this.currentConfig.enabledTools.join(", ") || "None"}`,
  `Compaction Policy: ${this.currentConfig.compaction.policy}`,
  `Compaction Threshold: ${this.currentConfig.compaction.compactionThreshold}`,
  `Compaction Apply Threshold: ${this.currentConfig.compaction.applyThreshold}`,
  `Pending Compaction: ${this.pendingCompaction ? "Yes" : "No"}`,
  `Max Steps: ${this.currentConfig.maxSteps}`,
  `System Prompt: ${this.currentConfig.systemPrompt}`,
])}`;
  }
}
