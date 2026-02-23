import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import ChatService from "../../ChatService.ts";
import {ChatServiceState} from "../../state/chatServiceState.ts";

export default async function reset(_remainder: string, agent: Agent): Promise<string> {
  const chatService = agent.requireServiceByType(ChatService);
  const initialModel = agent.getState(ChatServiceState).initialConfig.model;
  
  if (!initialModel) {
    throw new CommandFailedError("No initial model configured");
  }
  
  chatService.setModel(initialModel, agent);
  return `Model reset to ${initialModel}`;
}
