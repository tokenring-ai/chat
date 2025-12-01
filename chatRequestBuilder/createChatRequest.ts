import Agent from "@tokenring-ai/agent/Agent";
import {stepCountIs} from "@tokenring-ai/ai-client";
import type {ChatRequest} from "@tokenring-ai/ai-client/client/AIChatClient";
import pick from "@tokenring-ai/utility/object/pick";
import ChatService from "../ChatService.ts";
import {ChatConfig, ContextItem} from "../types.ts";

/**
 * Creates a chat request object.
 */
export async function createChatRequest(
  input: string,
  chatConfig: ChatConfig,
  agent: Agent,
): Promise<ChatRequest> {
  const chatService = agent.requireServiceByType(ChatService);

  const lastMessage = chatService.getLastMessage(agent);

  const messages: ContextItem[] = [];

  for (const source of lastMessage ? chatConfig.context.followUp : chatConfig.context.initial) {
    const handler = chatService.requireContextHandlerByName(source.type);

    for await (const item of handler(input, chatConfig, source, agent)) {
      messages.push(item);
    }
  }

  const request: ChatRequest = {
    messages,
    tools: {},
    stopWhen: stepCountIs(chatConfig.maxSteps),
    ...pick(chatConfig, [
      "temperature",
      "topP",
      "topK",
      "stopSequences",
      "presencePenalty",
      "frequencyPenalty",
    ]),
  };

  for (const toolName of chatConfig.enabledTools ?? []) {
    const {name, tool} = chatService.requireTool(toolName);
    const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
    request.tools[sanitizedName] = tool;
  }

  return request;
}
