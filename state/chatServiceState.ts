import {Agent} from "@tokenring-ai/agent";
import type {ResetWhat} from "@tokenring-ai/agent/AgentEvents";
import type {AgentStateSlice} from "@tokenring-ai/agent/types";
import {z} from "zod";
import async from "async";
import {ChatConfigMergedSchema, ParsedChatConfig, StoredChatMessage} from "../schema.ts";

const serializationSchema = z.object({
  currentConfig: ChatConfigMergedSchema,
  messages: z.array(z.any())
});

export class ChatServiceState implements AgentStateSlice<typeof serializationSchema> {
  name = "ChatServiceState";
  serializationSchema = serializationSchema;
  readonly initialConfig: ParsedChatConfig;
  currentConfig: ParsedChatConfig;
  parallelTools = false;
  toolQueue = async.queue(
    async (task: () => Promise<string | object>) => task(),
    1,
  );
  /** History of chat messages */
  messages: StoredChatMessage[] = [];

  constructor(initialConfig: ParsedChatConfig) {
    this.initialConfig = initialConfig;
    this.currentConfig = {...initialConfig};
  }

  async runToolMaybeInParallel(
    executeToolFunction: () => Promise<string | object>,
  ): Promise<string | object> {
    if (this.parallelTools) {
      return await executeToolFunction();
    } else {
      return await this.toolQueue.push(executeToolFunction);
    }
  }

  transferStateFromParent(parent: Agent): void {
    this.currentConfig.model = parent.getState(ChatServiceState).currentConfig.model;
  }

  reset(what: ResetWhat[]): void {
    if (what.includes("settings")) {
      this.currentConfig = {...this.initialConfig};
    }
    if (what.includes("chat")) {
      this.messages = [];
    }
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
      `Auto Compact: ${this.currentConfig.autoCompact}`,
      `Max Steps: ${this.currentConfig.maxSteps}`,
      `System Prompt: ${this.currentConfig.systemPrompt}`,
    ];
  }
}
