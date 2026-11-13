import type Agent from "@tokenring-ai/agent/Agent";
import type { ChatAttachment } from "@tokenring-ai/agent/AgentEvents";
import type AIChatClient from "@tokenring-ai/ai-client/client/AIChatClient";
import type { AIResponse } from "@tokenring-ai/ai-client/client/AIChatClient";
import { ChatModelRegistry } from "@tokenring-ai/ai-client/ModelRegistry";
import { LanguageModelUsageSchema } from "@tokenring-ai/ai-client/schema.client";
import { AgentLifecycleService } from "@tokenring-ai/lifecycle";
import { MetricsService } from "@tokenring-ai/metrics";
import { backoff } from "@tokenring-ai/utility/promise/backoff";
import EnhancedSet from "@tokenring-ai/utility/set/enhancedSet";
import ChatService from "./ChatService.ts";

import { AfterChatCompletion } from "./lifecycle.ts";
import type { ParsedChatConfig } from "./schema.ts";
import { ChatServiceState } from "./state/chatServiceState.ts";

type StopReason = "finished" | "longContext" | "maxSteps" | "maxCost" | "maxInputTokens" | "maxOutputTokens" | "maxRuntime";

function isThresholdReached(
  { inputTokens, outputTokens }: { inputTokens?: number | undefined; outputTokens?: number | undefined },
  chatClient: AIChatClient,
  threshold: number,
) {
  const totalTokens = (inputTokens ?? 0) + (outputTokens ?? 0);
  return totalTokens > chatClient.getModelSpec().maxContextLength * threshold;
}

/** Cumulative usage/cost for the current turn from completed steps. */
function getTurnTotals(steps: Array<{ usage: unknown }>, chatClient: AIChatClient) {
  let inputTokens = 0;
  let outputTokens = 0;
  let totalCost = 0;

  for (const step of steps) {
    const usage = LanguageModelUsageSchema.parse(step.usage);
    inputTokens += usage.inputTokens;
    outputTokens += usage.outputTokens;
    totalCost += chatClient.calculateCost(usage).total;
  }

  return { inputTokens, outputTokens, totalCost };
}

export type RunChatOptions = {
  input: string;
  attachments?: ChatAttachment[];
  chatConfig: ParsedChatConfig;
  agent: Agent;
};

/**
 * runChat tool: Runs a chat with the AI model, combining streamChat and runChat functionality.
 */
export default async function runChat({ input, attachments, chatConfig, agent }: RunChatOptions): Promise<AIResponse> {
  const chatModelRegistry = agent.requireService(ChatModelRegistry);
  const chatService = agent.requireService(ChatService);

  const model = chatService.requireModel(agent);

  const times = 5;
  let client: AIChatClient;
  try {
    client = await backoff({ times, interval: 1000, multiplier: 2 }, ({ attempt }) => {
      if (attempt > 1) {
        agent.setCurrentActivity(`Chat model ${model} is not responding, retry ${attempt}/${times}`);
        agent.getService(MetricsService)?.addRetries(1, agent);
      }
      return chatModelRegistry.getClient(model);
    });
  } catch (error) {
    agent.getService(MetricsService)?.recordError(agent, {
      type: "modelClientUnavailable",
      provider: model,
    });
    throw error;
  }

  const enabledTools = new EnhancedSet(chatConfig.enabledTools);
  let updatedTools = false;

  for (const [, tool] of chatService.getAvailableToolEntries()) {
    const enabled = enabledTools.has(tool.name);
    if (tool.toolDefinition?.adjustActivation) {
      const newEnabled = await tool.toolDefinition.adjustActivation(enabled, agent);
      if (newEnabled && !enabled) {
        enabledTools.add(tool.name);
        agent.infoMessage(`Auto-Activated tool ${tool.name}`);
        updatedTools = true;
      } else if (!newEnabled && enabled) {
        enabledTools.delete(tool.name);
        agent.infoMessage(`Auto-Deactivated tool ${tool.name}`);
      }
    }
  }

  if (updatedTools) {
    agent.mutateState(ChatServiceState, state => {
      state.currentConfig.enabledTools = enabledTools.valuesArray();
    });
  }

  const resolvedAttachments = await chatService.resolveAttachmentsForModel({
    attachments,
    modelSpec: client.getModelSpec(),
    allowRemoteAttachments: chatConfig.allowRemoteAttachments,
    agent,
  });

  const { messages, instructions } = await chatService.buildChatMessages({
    input,
    ...(resolvedAttachments?.length && { attachments: resolvedAttachments }),
    chatConfig,
    agent,
  });

  let stepCount: number = 0;
  let stopReason = "finished" as StopReason;
  let maxSteps = chatConfig.maxSteps;
  const { maxCost, maxInputTokens, maxOutputTokens, maxRuntime } = chatConfig;
  const runStartedAt = Date.now();

  agent.setCurrentActivity("Waiting for response");
  try {
    const response = await client.streamChat(
      {
        instructions,
        messages,
        async stopWhen(options) {
          // The step that just finished (stepCount still holds the previous count here). Reading
          // steps[stepCount - 1] lagged one step behind and never saw a turn's last step, which left
          // the context length at 0 after one-step replies and dropped that step's usage and cost.
          const lastStep = options.steps.length > stepCount ? options.steps.at(-1) : undefined;
          if (lastStep) {
            agent.mutateState(ChatServiceState, state => {
              state.contextLength = (lastStep.usage.inputTokens ?? 0) + (lastStep.usage.outputTokens ?? 0);
              state.addCosts(client.calculateCost(lastStep.usage));
              state.addUsage(LanguageModelUsageSchema.parse(lastStep.usage));
            });
          }

          const previousStepCount = stepCount;
          stepCount = options.steps.length;
          const stepDelta = stepCount - previousStepCount;
          if (stepDelta > 0) {
            agent.getService(MetricsService)?.addSteps(agent, stepDelta);
          }

          if (stepCount > 0) {
            const { compactionThreshold } = agent.getState(ChatServiceState).currentConfig.compaction;
            if (isThresholdReached(options.steps[stepCount - 1]!.usage, client, compactionThreshold)) {
              stopReason = "longContext";
              return true;
            }
          }

          // Resource limits for this turn (optional; undefined = unlimited)
          const { inputTokens, outputTokens, totalCost } = getTurnTotals(options.steps, client);
          const elapsedSeconds = (Date.now() - runStartedAt) / 1000;

          if (maxCost != null && totalCost >= maxCost) {
            stopReason = "maxCost";
            return true;
          }
          if (maxInputTokens != null && inputTokens >= maxInputTokens) {
            stopReason = "maxInputTokens";
            return true;
          }
          if (maxOutputTokens != null && outputTokens >= maxOutputTokens) {
            stopReason = "maxOutputTokens";
            return true;
          }
          if (maxRuntime != null && elapsedSeconds >= maxRuntime) {
            stopReason = "maxRuntime";
            return true;
          }

          if (maxSteps > 0 && stepCount > maxSteps) {
            if (agent.headless) {
              stopReason = "maxSteps";
              return true;
            }

            if (
              await agent.askForApproval({
                message: `The agent has completed ${options.steps.length} steps, which is longer than your configured limit of ${chatConfig.maxSteps}. Would you like to continue?`,
                defaultValue: false,
              })
            ) {
              maxSteps += chatConfig.maxSteps;
              return false;
            } else {
              stopReason = "maxSteps";
              return true;
            }
          }

          return false;
        },
        tools: Object.fromEntries(
          chatConfig.enabledTools.map(toolName => {
            const toolDefinition = chatService.requireTool(toolName);
            return [toolDefinition.name, toolDefinition.tool(agent)];
          }),
        ),
      },
      agent,
    );

    // Update the current message to follow up to the previous
    chatService.pushChatMessage(
      {
        messages,
        instructions,
        response,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      agent,
    );

    await agent.getService(AgentLifecycleService)?.executeHooks(new AfterChatCompletion(response), agent);

    const config = chatService.getChatConfig(agent);

    let { applyThreshold, compactionThreshold } = config.compaction;
    applyThreshold ??= compactionThreshold;

    if (applyThreshold < compactionThreshold) {
      agent.warningMessage(
        `Context compaction threshold was set lower than the context compaction apply threshold, setting compaction apply threshold to ${compactionThreshold}`,
      );
      applyThreshold = compactionThreshold;
    }
    const reachedCompactionThreshold = stopReason === "longContext" || isThresholdReached(response.lastStepUsage, client, compactionThreshold);

    const reachedApplyThreshold = isThresholdReached(response.lastStepUsage, client, applyThreshold);

    let appliedCompaction = false;

    if (reachedApplyThreshold && chatService.hasPendingCompaction(agent)) {
      appliedCompaction = chatService.applyPendingCompaction(agent);
      if (appliedCompaction) {
        agent.infoMessage("Applied the stored context compaction");
      }
    }

    if (reachedCompactionThreshold) {
      if (
        config.compaction.policy === "automatic" ||
        (config.compaction.policy === "ask" &&
          agent.headless &&
          (await agent.askForApproval({
            message: "Context is getting long. Would you like to compact it to save tokens?",
            defaultValue: true,
          })))
      ) {
        if (!chatService.hasPendingCompaction(agent) && !chatService.isCompactionInProgress(agent)) {
          agent.infoMessage("Context is getting long. Preparing a compaction summary...");
          agent.setCurrentActivity("Preparing context compaction...");
          if (config.compaction.background) {
            void chatService.stageContextCompaction(config.compaction, agent).catch(error => {
              agent.errorMessage(`Failed to prepare context compaction: ${Error.isError(error) ? error.message : String(error)}`);
            });
          } else {
            await chatService.stageContextCompaction(config.compaction, agent);
          }
        }

        if (stopReason === "longContext" && appliedCompaction) {
          const remainingSteps = chatConfig.maxSteps - stepCount;
          const { inputTokens, outputTokens, totalCost } = getTurnTotals([{ usage: response.totalUsage }], client);
          const elapsedSeconds = (Date.now() - runStartedAt) / 1000;
          const remainingCost = maxCost != null ? maxCost - totalCost : undefined;
          const remainingInputTokens = maxInputTokens != null ? maxInputTokens - inputTokens : undefined;
          const remainingOutputTokens = maxOutputTokens != null ? maxOutputTokens - outputTokens : undefined;
          const remainingRuntime = maxRuntime != null ? maxRuntime - elapsedSeconds : undefined;
          const budgetExhausted =
            (remainingCost != null && remainingCost <= 0) ||
            (remainingInputTokens != null && remainingInputTokens <= 0) ||
            (remainingOutputTokens != null && remainingOutputTokens <= 0) ||
            (remainingRuntime != null && remainingRuntime <= 0);

          if (remainingSteps > 0 && !budgetExhausted) {
            const remainingConfig: ParsedChatConfig = {
              ...chatConfig,
              maxSteps: remainingSteps,
              ...(remainingCost != null && { maxCost: remainingCost }),
              ...(remainingInputTokens != null && { maxInputTokens: remainingInputTokens }),
              ...(remainingOutputTokens != null && { maxOutputTokens: remainingOutputTokens }),
              ...(remainingRuntime != null && { maxRuntime: remainingRuntime }),
            };

            agent.infoMessage("Context compaction applied, and agent still has work to do. Continuing work...");
            return await runChat({
              input: "Continue",
              chatConfig: remainingConfig,
              agent,
            });
          }
        }
      }
    }

    if (stopReason === "maxSteps") {
      // TODO: Should this throw an error?
      agent.infoMessage("Agent stopped due to reaching the configured maxSteps");
    } else if (stopReason === "maxCost") {
      agent.infoMessage("Agent stopped due to reaching the configured maxCost");
    } else if (stopReason === "maxInputTokens") {
      agent.infoMessage("Agent stopped due to reaching the configured maxInputTokens");
    } else if (stopReason === "maxOutputTokens") {
      agent.infoMessage("Agent stopped due to reaching the configured maxOutputTokens");
    } else if (stopReason === "maxRuntime") {
      agent.infoMessage("Agent stopped due to reaching the configured maxRuntime");
    }

    return response; // Return the full response object
  } finally {
    agent.setCurrentActivity("Chat completed");
  }
}
