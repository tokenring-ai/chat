import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import ChatService from "../../ChatService.ts";
import {ChatServiceState} from "../../state/chatServiceState.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

function execute({
                   agent,
                 }: AgentCommandInputType<typeof inputSchema>): string {
  const initialModel = agent.getState(ChatServiceState).initialConfig.model;
  if (!initialModel)
    throw new CommandFailedError("No initial model configured");
  agent.requireServiceByType(ChatService).setModel(initialModel, agent);
  return `Model reset to ${initialModel}`;
}

export default {
  name: "model reset",
  description: "Reset to initial model",
  inputSchema,
  execute,
  help: `Reset the chat model to the initial configured value.

## Example

/model reset`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
