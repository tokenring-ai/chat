import Agent from "@tokenring-ai/agent/Agent";
import type {InputAttachment} from "@tokenring-ai/agent/AgentEvents";
import AIChatClient, {AIResponse} from "@tokenring-ai/ai-client/client/AIChatClient";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";
import {AgentLifecycleService} from "@tokenring-ai/lifecycle";
import {backoff} from "@tokenring-ai/utility/promise/backoff";
import ChatService from "./ChatService.ts";
import {AfterChatCompletion} from "./hooks.ts";
import {ParsedChatConfig} from "./schema.ts";
import {ChatServiceState} from "./state/chatServiceState.ts";

type StopReason = "finished" | "longContext" | "maxSteps";

function shouldCompact({ inputTokens, outputTokens}: { inputTokens?: number, outputTokens?: number }, chatClient: AIChatClient, agent: Agent) {
  const { compactionThreshold } = agent.getState(ChatServiceState).currentConfig.compaction;

  const totalTokens = (inputTokens ?? 0) + (outputTokens ?? 0);
  return totalTokens > chatClient.getModelSpec().maxContextLength * compactionThreshold;
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
export default async function runChat({
                                        input,
                                        attachments,
                                        chatConfig,
                                        agent,
                                      } : RunChatOptions): Promise<AIResponse> {
  const chatModelRegistry =
    agent.requireServiceByType(ChatModelRegistry);
  const chatService = agent.requireServiceByType(ChatService);

  const model = chatService.requireModel(agent);

  const times = 5;
  const client = await backoff({ times, interval: 1000, multiplier: 2}, ({ attempt }) => {
    if (attempt > 1) {
      agent.setCurrentActivity(`Chat model ${model} is not responding, retry ${attempt}/${times}`);
    }
    return chatModelRegistry.getClient(model);
  });

  if (!client) throw new Error(`No online client found for model ${model}`);

  const enabledTools = chatConfig.enabledTools;

  for (const [, tool] of chatService.getAvailableToolEntries()) {
    if (chatConfig.enabledTools.includes(tool.name)) continue;
    const activate = tool?.toolDefinition?.autoActivate?.(agent) ?? false;
    if (activate) {
      agent.infoMessage(`Auto-Activated tool ${tool.name}`);
      enabledTools.push(tool.name);
    }
  }

  const requestMessages = await chatService.buildChatMessages({input, attachments, chatConfig, agent });

  let stepCount: number = 0;
  let stopReason = "finished" as StopReason;
  let maxSteps = chatConfig.maxSteps;

  agent.setCurrentActivity("Waiting for response");
  try {
    const response = await client.streamChat({
      messages: requestMessages,
      async stopWhen(options) {
        stepCount = options.steps.length;
        if (stepCount > 0) {
          if (shouldCompact(options.steps[stepCount - 1].usage, client, agent)) {
            stopReason = "longContext";
            return true;
          }
        }

        if (maxSteps > 0 && stepCount > maxSteps) {
          if (agent.headless) {
            stopReason = "maxSteps";
            return true;
          }

          if (await agent.askForApproval({
            message: `The agent has completed ${options.steps.length} steps, which is longer than your configured limit of ${chatConfig.maxSteps}. Would you like to continue?`,
            default: false,
            timeout: 60
          })) {
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
        chatConfig.enabledTools.map((toolName) => {
          const toolDefinition = chatService.requireTool(toolName);
          return [toolDefinition.name, toolDefinition.tool]
        })
      )
    }, agent);

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

    if (stopReason === "longContext" || shouldCompact(response.lastStepUsage, client, agent)) {
      const config = chatService.getChatConfig(agent);
      if ( config.compaction.policy === "automatic" || (config.compaction.policy === "ask" && (agent.headless && await agent.askForApproval({
        message:
          "Context is getting long. Would you like to compact it to save tokens?",
        default: true,
        timeout: 30,
      })))) {
        agent.infoMessage(
          "Context is getting long. Compacting context...",
        );
        agent.setCurrentActivity("Compacting context...");
        await chatService.compactContext(config.compaction, agent);
        if (stopReason === "longContext") {
          const remainingSteps = chatConfig.maxSteps - stepCount;
          if (remainingSteps > 0) {
            agent.infoMessage("Context compacted, and agent still has work to do. Continuing work...");
            return await runChat({ input: "Continue", chatConfig: {...chatConfig, maxSteps: remainingSteps}, agent});
          }
        }
      }
    }

    if (stopReason === "maxSteps") {
      if (agent.headless) {
        agent.infoMessage("Agent stopped due to reaching the configured maxSteps")
      } else {
        await agent.askForApproval({
          message: "Agent stopped due to reaching the configured maxSteps. Would you like to continue?"
        })
        return await runChat({ input: "Continue", chatConfig, agent });
      }
    }

    return response; // Return the full response object
  } finally {
    agent.setCurrentActivity("Chat completed");
  }
}
