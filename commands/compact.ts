import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import {compactContext} from "../util/compactContext.ts";

const description =
  "/compact - Compact conversation context by summarizing prior messages";

async function execute(remainder: string, agent: Agent): Promise<void> {
  agent.systemMessage("Compacting context...");
  await compactContext(agent);
}

export function help(): string[] {
  return [
    "/compact",
    "  - Compacts the conversation context by creating a summary of all prior messages",
    "  - Helps reduce token usage when conversations get long",
  ];
}
export default {
  description,
  execute,
  help,
} as TokenRingAgentCommand