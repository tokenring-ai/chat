import {Agent} from "@tokenring-ai/agent";
import ChatService from "../../ChatService.ts";

export default async function context(_remainder: string, agent: Agent): Promise<void> {
  try {
    const chatService = agent.requireServiceByType(ChatService);
    const chatConfig = chatService.getChatConfig(agent);

    const messages = await chatService.buildChatMessages("input", chatConfig, agent);

    agent.infoLine("Context items that would be added to chat request:");
    agent.infoLine(`Total messages: ${messages.length}`);

    messages.slice(0, -1).forEach((msg, index) => {
      const content =
        typeof msg.content === "string"
          ? msg.content
            ? Array.isArray(msg.content)
              ? msg.content[0].text
              : msg.content
            : msg.content
          : JSON.stringify(msg.content);
      const preview =
        content.length > 100 ? content.substring(0, 130) + "..." : content;
      agent.infoLine(`${index + 1}. [${msg.role}] ${preview}`);
    });
  } catch (error) {
    agent.errorLine(`Error building context: ${error}`);
  }
}