import Agent from "@tokenring-ai/agent/Agent";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";
import {createChatRequest} from "../chatRequestBuilder/createChatRequest.js";
import ChatService from "../ChatService.ts";

export async function compactContext(focus: string | null, agent: Agent): Promise<void> {
  focus ??= "important details, context, and what was being worked on"
  const chatService = agent.requireServiceByType(ChatService);
  const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);

  const messages = chatService.getChatMessages(agent);
  if (messages.length === 0) return;

  const request = await createChatRequest(
    `Please provide a detailed and comprehensive summary of the prior conversation, focusing on ${focus}`,
    {
      ...chatService.getChatConfig(agent),
      enabledTools: []
    },
    agent,
  );

  const client = await chatModelRegistry.getFirstOnlineClient(
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

  const {tools, ...storedRequest } = request;

  // Update the current message to follow up to the previous
  chatService.pushChatMessage(
    {
      request: storedRequest,
      response,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    agent,
  );

  agent.infoLine("Context compacted successfully");
}
