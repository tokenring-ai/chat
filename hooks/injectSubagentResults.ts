import { AfterSubAgentResponse } from "@tokenring-ai/agent/hooks";
import type { HookSubscription } from "@tokenring-ai/lifecycle/types";
import { HookCallback } from "@tokenring-ai/lifecycle/util/hooks";

import { AfterChatCompletion } from "../lifecycle.ts";
import { ChatServiceState } from "../state/chatServiceState";

const name = "injectSubAgentResults";
const displayName = "Chat/Inject Subagent Results";
const description = "Injects the results of subagent into the parent agents chat stream";

const callbacks = [
  new HookCallback(AfterSubAgentResponse, (data, agent) => {
    const lastStep = data.request.steps[data.request.steps.length - 1];
    const lastMessage = typeof lastStep === "string" ? lastStep : lastStep.message;

    agent.mutateState(ChatServiceState, state => {
      state.injectedMessages.push(
        `
        
### The user invoked the ${data.request.agentType} subagent, with the following instructions:
${lastMessage}

### The ${data.request.agentType} subagent responded with the following:
${data.result.status}: ${data.result.response}
        `.trim(),
      );
    });
  }),
  new HookCallback(AfterChatCompletion, (_data, agent) => {
    agent.mutateState(ChatServiceState, state => {
      state.injectedMessages.splice(0);
    });
  }),
];

export default {
  name,
  displayName,
  description,
  callbacks,
} satisfies HookSubscription<any>;
