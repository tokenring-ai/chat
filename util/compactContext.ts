import Agent from "@tokenring-ai/agent/Agent";
import ModelRegistry from "@tokenring-ai/ai-client/ModelRegistry";
import {createChatRequest} from "../chatRequestBuilder/createChatRequest.js";
import ChatService from "../ChatService.ts";

export async function compactContext(agent: Agent): Promise<void> {
  const chatService = agent.requireServiceByType(ChatService);
  const modelRegistry = agent.requireServiceByType(ModelRegistry);

  const messages = chatService.getChatMessages(agent);
  if (messages.length === 0) return;

  const request = await createChatRequest(
    {
      input: `Please provide a detailed summary of the prior conversation, including all important details, context, and what was being worked on`,
      systemPrompt:
        "You are a helpful assistant that creates comprehensive summaries of conversations.",
      includeContextItems: true,
      includeTools: false,
      includePriorMessages: true,
    },
    agent,
  );

  const client = await modelRegistry.chat.getFirstOnlineClient(
    chatService.getModel(agent),
  );

  const [output, response] = await agent.busyWhile(
    "Waiting for response from AI...",
    client.streamChat(request, agent),
  );

  //Include just the system messages and the response
  request.messages = request.messages.filter(
    (message) => message.role === "system",
  );

  chatService.clearChatMessages(agent);

  // Update the current message to follow up to the previous
  chatService.pushChatMessage(
    {
      request,
      response,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    agent,
  );

  agent.infoLine("Context compacted successfully");
}
