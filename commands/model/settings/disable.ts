import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import {serializeModel} from "@tokenring-ai/ai-client/util/modelSettings";
import {ChatService} from "../../../index.ts";

async function execute(remainder: string, agent: Agent): Promise<string> {
  const keys = remainder?.trim().split(/\s+/).filter(Boolean);
  if (!keys?.length) throw new CommandFailedError("/model settings disable requires at least one key");
  const chatService = agent.requireServiceByType(ChatService);
  const {base, settings} = chatService.getModelAndSettings(agent);
  for (const key of keys) settings.delete(key);
  const newModel = serializeModel(base, settings);
  chatService.setModel(newModel, agent);
  return `Disabled settings. New model: ${newModel}`;
}

export default {
  name: "model settings disable", description: "Disable model feature flags", help: `# /model settings disable <key> ...

Disable one or more model feature flags.

## Example

/model settings disable reasoning
/model settings disable reasoning websearch`, execute } satisfies TokenRingAgentCommand;
