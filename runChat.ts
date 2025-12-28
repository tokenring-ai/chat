import {AgentLifecycleService} from "@tokenring-ai/agent";
import Agent from "@tokenring-ai/agent/Agent";
import AIChatClient, {AIResponse} from "@tokenring-ai/ai-client/client/AIChatClient";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";
import {backoff} from "@tokenring-ai/utility/promise/backoff";
import ChatService from "./ChatService.ts";
import {ChatConfig} from "./types.ts";
import {compactContext} from "./util/compactContext.ts";

type StopReason = "finished" | "longContext" | "maxSteps";

function shouldCompact({ inputTokens, outputTokens}: { inputTokens?: number, outputTokens?: number }, chatClient: AIChatClient) {
  //TODO: make the compaction threshold configurable
  const totalTokens = (inputTokens ?? 0) + (outputTokens ?? 0);
  return totalTokens > chatClient.getModelSpec().contextLength * 0.9;
}


/**
 * runChat tool: Runs a chat with the AI model, combining streamChat and runChat functionality.
 */
export default async function runChat(
  input: string,
  chatConfig: ChatConfig,
  agent: Agent,
): Promise<[string, AIResponse]> {
  const chatModelRegistry =
    agent.requireServiceByType(ChatModelRegistry);
  const chatService = agent.requireServiceByType(ChatService);

  const model = chatService.getModel(agent);

  const client = await agent.busyWhile(
    "Waiting for an an online model to respond...",
    backoff({ times: 5, interval: 1000, multiplier: 2}, () =>
      chatModelRegistry.getClient(model)
    )
  );

  if (!client) throw new Error(`No online client found for model ${model}`);

  agent.infoLine(`[runChat] Using model ${client.getModelId()}`);


  const requestMessages = await chatService.buildChatMessages(input, chatConfig, agent);

  let stepCount: number = 0;
  let stopReason = "finished" as StopReason;

  agent.setBusyWith("Sending request to AI...");
  try {
    const [output, response] = await client.streamChat({
      messages: requestMessages,
      async stopWhen(options) {
        stepCount = options.steps.length;
        if (stepCount > 0) {
          if (shouldCompact(options.steps[stepCount - 1].usage, client)) {
            stopReason = "longContext";
            return true;
          }
        }

        if (stepCount > chatConfig.maxSteps) {
          if (agent.headless) {
            stopReason = "maxSteps";
            return true;
          }

          if (! await agent.askHuman({
            type: "askForConfirmation",
            message: `The agent has completed ${options.steps.length} steps, which is longer than your configured limit of ${chatConfig.maxSteps}. Would you like to continue?`,
            default: false,
            timeout: 60
          })) {
            stopReason = "maxSteps";
            return true;
          }
        }

        return false;
      },
      tools: Object.fromEntries(
        chatConfig.enabledTools.map((toolName) =>
          [toolName, chatService.requireTool(toolName).tool]
        )
      ),
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

  const finalOutput: string = output ?? "";

  await agent.getServiceByType(AgentLifecycleService)?.executeHooks(agent, "afterChatCompletion", finalOutput, response);

  if (shouldCompact(response.usage, client)) {
    const config = chatService.getChatConfig(agent);
    if (config.autoCompact || agent.headless || await agent.askHuman({
      type: "askForConfirmation",
      message:
        "Context is getting long. Would you like to compact it to save tokens?",
      default: true,
      timeout: 30,
    })) {
      agent.infoLine(
        "Context is getting long. Compacting context...",
      );
      agent.setBusyWith("Compacting context...");
      await compactContext(null, agent);
      if (stopReason === "longContext") {
        const remainingSteps = chatConfig.maxSteps - stepCount;
        if (remainingSteps > 0) {
          agent.infoLine("Context compacted, and agent still has work to do. Continuing work...");
          return await runChat("Continue", {...chatConfig, maxSteps: remainingSteps}, agent);
        }
      }
    }
  }

  if (stopReason === "maxSteps") {

  }


  return [finalOutput, response]; // Return the full response object
  } finally {
    agent.setBusyWith(null);
  }
}
