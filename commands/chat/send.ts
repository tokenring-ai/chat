import {Agent} from "@tokenring-ai/agent";
import ChatService from "../../ChatService.ts";
import runChat from "../../runChat.ts";
import {outputChatAnalytics} from "../../util/outputChatAnalytics.ts";

export default async function send(message: string, agent: Agent): Promise<void> {
  if (!message) {
    agent.infoLine("Please enter a message to send to AI, or type /help chat for available commands.");
    return;
  }
  const chatService = agent.requireServiceByType(ChatService);


  const chatConfig = chatService.getChatConfig(agent);
  const response = await runChat(message, chatConfig, agent);
  outputChatAnalytics(response, agent);
}