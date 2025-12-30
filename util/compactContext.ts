import Agent from "@tokenring-ai/agent/Agent";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";
import ChatService from "../ChatService.ts";

export async function compactContext(focus: string | null, agent: Agent): Promise<void> {
  focus ??= "important details, context, and what was being worked on"
  const chatService = agent.requireServiceByType(ChatService);
  const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);

  const messages = chatService.getChatMessages(agent);
  if (messages.length === 0) return;

  const requestMessages = await chatService.buildChatMessages(
    `Please provide a detailed and comprehensive summary of the prior conversation, focusing on ${focus}`,
    chatService.getChatConfig(agent),
    agent
  );

  const client = await chatModelRegistry.getClient(
    chatService.requireModel(agent),
  );

  const [output, response] = await agent.busyWhile(
    "Waiting for response from AI...",
    client.streamChat({
      messages: requestMessages,
      tools: {}
    }, agent),
  );

  chatService.clearChatMessages(agent);

  // Update the current message to follow up to the previous
  chatService.pushChatMessage(
    {
      request: {
        messages: requestMessages.filter(
          (message) => message.role === "system",
        ),
      },
      response,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    agent,
  );

  agent.infoLine("Context compacted successfully");
}
