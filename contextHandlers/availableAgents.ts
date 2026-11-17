import AgentManager from "@tokenring-ai/agent/services/AgentManager";
import type { ChatInputMessage } from "@tokenring-ai/ai-client/client/AIChatClient";
import type { ContextHandlerOptions } from "../schema.ts";

/**
 * The agent types the agent can hand work to. Required by tools that take an agent type, such as
 * `task_create` and `scheduler_add_task`, so the model picks a type that exists.
 */
export default async function* getContextItems({ agent }: ContextHandlerOptions): AsyncGenerator<ChatInputMessage> {
  const types = agent.requireService(AgentManager).getAgentConfigEntries();
  if (types.length === 0) return;
  yield {
    role: "user",
    content: `/* The following agent types are available for use with agent and task planning tools */\n${types
      .map(([type, config]) => `- ${type}: ${config.description}`)
      .join("\n")}`,
  };
}
