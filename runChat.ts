import {AgentLifecycleService} from "@tokenring-ai/agent";
import Agent from "@tokenring-ai/agent/Agent";
import type {AIResponse} from "@tokenring-ai/ai-client/client/AIChatClient";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";
import omit from "@tokenring-ai/utility/object/omit";
import {createChatRequest,} from "./chatRequestBuilder/createChatRequest.ts";
import ChatService from "./ChatService.ts";
import {ChatConfig} from "./types.ts";
import {compactContext} from "./util/compactContext.ts";

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

  const request = await createChatRequest(
    input,
    chatConfig,
    agent,
  );

  try {
    const client = await agent.busyWhile(
      "Waiting for an an online model to respond...",
      chatModelRegistry.getFirstOnlineClient(model),
    );

    if (!client) throw new Error(`No online client found for model ${model}`);

    agent.infoLine(`[runChat] Using model ${client.getModelId()}`);

    const [output, response] = await agent.busyWhile(
      "Waiting for response from AI...",
      client.streamChat(request, agent),
    );

    // Update the current message to follow up to the previous
    chatService.pushChatMessage(
      {
        request: omit(request,["tools"]),
        response,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      agent,
    );

    const finalOutput: string = output ?? "";

    await agent.getServiceByType(AgentLifecycleService)?.executeHooks(agent, "afterChatCompletion", finalOutput, response);

    // Check if context compacting is needed
    const messages = chatService.getChatMessages(agent);
    if (messages.length > 0) {
      const totalTokens = messages.reduce(
        (sum, msg) => sum + (msg.response.usage.inputTokens || 0),
        0,
      );
      const contextLength = client.getModelSpec().contextLength;

      if (totalTokens > contextLength * 0.9) {
        const config = chatService.getChatConfig(agent);
        if (config.autoCompact) {
          agent.infoLine(
            "Context is getting long. Automatically compacting context...",
          );
          await compactContext(agent);
        } else {
          const shouldCompact = await agent.askHuman({
            type: "askForConfirmation",
            message:
              "Context is getting long. Would you like to compact it to save tokens?",
          });

          if (shouldCompact) {
            agent.infoLine("Compacting context...");
            await compactContext(agent);
          }
        }
      }
    }

    return [finalOutput, response]; // Return the full response object
  } catch (err: unknown) {
    agent.warningLine("AI request cancelled, restoring prior chat state.");
    throw err;
  }
}
