import {Agent} from "@tokenring-ai/agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import ChatService from "../../ChatService.ts";
import runChat from "../../runChat.ts";
import {getChatAnalytics} from "../../util/getChatAnalytics.ts";

export default async function send(message: string, agent: Agent): Promise<string> {
  if (!message) {
    throw new CommandFailedError("Please enter a message to send to AI, or type /help chat for available commands.");
  }
  const chatService = agent.requireServiceByType(ChatService);


  const chatConfig = chatService.getChatConfig(agent);

  const response = await runChat(message, chatConfig, agent);

  return `Chat Complete\n${getChatAnalytics(response)}`;
}