import {AgentStateSlice} from "@tokenring-ai/agent/types";
import async from "async";
import {z} from "zod";
import {ChatConfigMergedSchema, ParsedChatConfig, StoredChatMessage, type TokenRingToolResult} from "../schema.ts";

const serializationSchema = z.object({
  currentConfig: ChatConfigMergedSchema,
  messages: z.array(z.any())
});

export class ChatServiceState extends AgentStateSlice<typeof serializationSchema> {
  currentConfig: ParsedChatConfig;
  parallelTools = false;
  toolQueue = async.queue(
    async (task: () => Promise<string | object>) => task(),
    1,
  );
  /** History of chat messages */
  messages: StoredChatMessage[] = [];

  constructor(readonly initialConfig: ParsedChatConfig) {
    super("ChatServiceState", serializationSchema);
    this.currentConfig = {...initialConfig};
  }

  async runToolMaybeInParallel(
    executeToolFunction: () => Promise<TokenRingToolResult>,
  ): Promise<TokenRingToolResult> {
    if (this.parallelTools) {
      return await executeToolFunction();
    } else {
      return await this.toolQueue.push(executeToolFunction);
    }
  }

  resetSettings(): void {
    this.currentConfig = {...this.initialConfig};
  }

  serialize(): z.output<typeof serializationSchema> {
    return {
      currentConfig: this.currentConfig,
      messages: this.messages,
    };
  }

  deserialize(data: z.output<typeof serializationSchema>): void {
    this.currentConfig = data.currentConfig || {...this.initialConfig};
    this.messages = data.messages || [];
  }

  show(): string[] {
    return [
      `Messages: ${this.messages.length}`,
      `Enabled Tools: ${this.currentConfig.enabledTools?.join(", ") || "None"}`,
      `Compaction Policy: ${this.currentConfig.compaction.policy}`,
      `Compaction Threshold: ${this.currentConfig.compaction.compactionThreshold}`,
      `Max Steps: ${this.currentConfig.maxSteps}`,
      `System Prompt: ${this.currentConfig.systemPrompt}`,
    ];
  }
}
