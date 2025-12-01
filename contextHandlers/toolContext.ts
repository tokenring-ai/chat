import type Agent from "@tokenring-ai/agent/Agent";
import {ChatInputMessage} from "@tokenring-ai/ai-client/client/AIChatClient";
import {ChatService} from "../index.ts";
import {ChatConfig} from "../types.ts";
import z from "zod";

export default async function * getContextItems(input: string, chatConfig: ChatConfig, params: any, agent: Agent): AsyncGenerator<ChatInputMessage> {
  const chatService = agent.requireServiceByType(ChatService);
  const requiredContextHandlers = new Set<string>();

  for (const tool of chatService.getEnabledTools(agent)) {
    const {toolDefinition} = chatService.requireTool(tool);
    for (const item of toolDefinition?.requiredContextHandlers ?? []) {
      requiredContextHandlers.add(item);
    }
  }


  for (const type of requiredContextHandlers) {
    const contextHandler = chatService.requireContextHandlerByName(type);
    yield * contextHandler(input, chatConfig, { type }, agent);
  }
}