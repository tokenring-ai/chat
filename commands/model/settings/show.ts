import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";
import markdownList from "@tokenring-ai/utility/string/markdownList";
import {ChatService} from "../../../index.ts";

export async function show(_remainder: string, agent: Agent): Promise<string> {
  const chatService = agent.requireServiceByType(ChatService);
  const {currentModel, base, settings} = chatService.getModelAndSettings(agent);
  const lines: string[] = [`Current model: ${currentModel}`, `Base model: ${base}`];
  if (settings.size === 0) {
    lines.push("Enabled settings: (none)");
  } else {
    lines.push("Enabled settings:");
    lines.push(markdownList(Array.from(settings.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(e => `${e[0]}: ${e[1]}`)));
  }
  const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);
  const client = await chatModelRegistry.getClient(base);
  const availableKeys = Object.keys(client.getModelSpec().settings || {});
  lines.push(availableKeys.length === 0 ? "Available settings: (none)" : "Available settings:");
  if (availableKeys.length > 0) lines.push(markdownList(availableKeys.sort()));
  return lines.join("\n");
}

export default { name: "model settings show", description: "/model settings show - Show model settings", help: `# /model settings show

Show the currently enabled feature flags and all available settings for the current model.

## Example

/model settings show`, execute: show } satisfies TokenRingAgentCommand;
