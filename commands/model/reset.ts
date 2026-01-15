import Agent from "@tokenring-ai/agent/Agent";
import ChatService from "../../ChatService.ts";
import {ChatServiceState} from "../../state/chatServiceState.ts";

export default async function reset(_remainder: string, agent: Agent): Promise<void> {
  const chatService = agent.requireServiceByType(ChatService);
  const initialModel = agent.getState(ChatServiceState).initialConfig.model;
  
  if (initialModel) {
    chatService.setModel(initialModel, agent);
    agent.infoMessage(`Model reset to ${initialModel}`);
  } else {
    agent.errorMessage("No initial model configured");
  }
}
