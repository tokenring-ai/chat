import type Agent from "@tokenring-ai/agent/Agent";
import type { InputAttachment } from "@tokenring-ai/agent/AgentEvents";
import type AIChatClient from "@tokenring-ai/ai-client/client/AIChatClient";
import type { AIResponse } from "@tokenring-ai/ai-client/client/AIChatClient";
import { ChatModelRegistry } from "@tokenring-ai/ai-client/ModelRegistry";
import { AgentLifecycleService } from "@tokenring-ai/lifecycle";
import { backoff } from "@tokenring-ai/utility/promise/backoff";
import ChatService from "./ChatService.ts";

import { AfterChatCompletion } from "./lifecycle.ts";
import type { ParsedChatConfig } from "./schema.ts";
import { ChatServiceState } from "./state/chatServiceState.ts";

type StopReason = "finished" | "longContext" | "maxSteps";

function isThresholdReached(
  { inputTokens, outputTokens }: { inputTokens?: number | undefined; outputTokens?: number | undefined },
  chatClient: AIChatClient,
  threshold: number,
) {
  const totalTokens = (inputTokens ?? 0) + (outputTokens ?? 0);
  return totalTokens > chatClient.getModelSpec().maxContextLength * threshold;
}

export type RunChatOptions = {
  input: string;
  attachments?: InputAttachment[];
  chatConfig: ParsedChatConfig;
  agent: Agent;
};

/**
 * runChat tool: Runs a chat with the AI model, combining streamChat and runChat functionality.
 */
export default async function runChat({ input, attachments, chatConfig, agent }: RunChatOptions): Promise<AIResponse> {
  const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);
  const chatService = agent.requireServiceByType(ChatService);

  const model = chatService.requireModel(agent);

  const times = 5;
  const client = await backoff({ times, interval: 1000, multiplier: 2 }, ({ attempt }) => {
    if (attempt > 1) {
      agent.setCurrentActivity(`Chat model ${model} is not responding, retry ${attempt}/${times}`);
    }
    return chatModelRegistry.getClient(model);
  });

  if (!client) throw new Error(`No online client found for model ${model}`);

  const enabledTools = new Set(chatConfig.enabledTools);
  let updatedTools = false;

  for (const [, tool] of chatService.getAvailableToolEntries()) {
    const enabled = enabledTools.has(tool.name);
    if (tool?.toolDefinition?.adjustActivation) {
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
      state.currentConfig.enabledTools = Array.from(enabledTools);
    });
  }

  const requestMessages = await chatService.buildChatMessages({
    input,
    ...(attachments?.length && { attachments }),
    chatConfig,
    agent,
  });

  let stepCount: number = 0;
  let stopReason = "finished" as StopReason;
  let maxSteps = chatConfig.maxSteps;

  agent.setCurrentActivity("Waiting for response");
  try {
    const response = await client.streamChat(
      {
        messages: requestMessages,
        async stopWhen(options) {
          stepCount = options.steps.length;
          if (stepCount > 0) {
            const { compactionThreshold } = agent.getState(ChatServiceState).currentConfig.compaction;
            if (isThresholdReached(options.steps[stepCount - 1].usage, client, compactionThreshold)) {
              stopReason = "longContext";
              return true;
            }
          }

          if (maxSteps > 0 && stepCount > maxSteps) {
            if (agent.headless) {
              stopReason = "maxSteps";
              return true;
            }

            if (
              await agent.askForApproval({
                message: `The agent has completed ${options.steps.length} steps, which is longer than your configured limit of ${chatConfig.maxSteps}. Would you like to continue?`,
                default: false,
                timeout: 60,
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
            return [toolDefinition.name, toolDefinition.tool];
          }),
        ),
      },
      agent,
    );

    // Update the current message to follow up to the previous
    chatService.pushChatMessage(
      {
        request: { messages: requestMessages },
        response,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      agent,
    );

    await agent.getServiceByType(AgentLifecycleService)?.executeHooks(new AfterChatCompletion(response), agent);

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
            default: true,
            timeout: 30,
          })))
      ) {
        if (!chatService.hasPendingCompaction(agent) && !chatService.isCompactionInProgress(agent)) {
          agent.infoMessage("Context is getting long. Preparing a compaction summary...");
          agent.setCurrentActivity("Preparing context compaction...");
          if (config.compaction.background) {
            void chatService.stageContextCompaction(config.compaction, agent).catch(error => {
              agent.errorMessage(`Failed to prepare context compaction: ${error instanceof Error ? error.message : String(error)}`);
            });
          } else {
            await chatService.stageContextCompaction(config.compaction, agent);
          }
        }

        if (stopReason === "longContext" && appliedCompaction) {
          const remainingSteps = chatConfig.maxSteps - stepCount;
          if (remainingSteps > 0) {
            agent.infoMessage("Context compaction applied, and agent still has work to do. Continuing work...");
            return await runChat({
              input: "Continue",
              chatConfig: { ...chatConfig, maxSteps: remainingSteps },
              agent,
            });
          }
        }
      }
    }

    if (stopReason === "maxSteps") {
      if (agent.headless) {
        agent.infoMessage("Agent stopped due to reaching the configured maxSteps");
      } else {
        await agent.askForApproval({
          message: "Agent stopped due to reaching the configured maxSteps. Would you like to continue?",
        });
        return await runChat({ input: "Continue", chatConfig, agent });
      }
    }

    return response; // Return the full response object
  } finally {
    agent.setCurrentActivity("Chat completed");
  }
}
