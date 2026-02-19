import Agent from "@tokenring-ai/agent/Agent";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";
import markdownList from "@tokenring-ai/utility/string/markdownList";
import {ChatService} from "../../../index.ts";
export default async function show(_remainder: string, agent: Agent): Promise<void> {
  const chatService = agent.requireServiceByType(ChatService);
  const {currentModel, base, settings} = chatService.getModelAndSettings(agent);
  const lines: string[] = [`Current model: ${currentModel}`, `Base model: ${base}`];

  const keys = Object.keys(settings);
  if (settings.size === 0) {
    lines.push("Enabled settings: (none)");
  } else {
    lines.push("Enabled settings:");
    lines.push(
      markdownList(
        Array.from(settings.entries())
        .sort((a,b) =>
          a[0].localeCompare(b[0])
        ).map(entry => `${entry[0]}: ${entry[1]}`)
      )
    );
  }

  const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);
  const client = await chatModelRegistry.getClient(base);
  const availableKeys = Object.keys(client.getModelSpec().settings || {});
  lines.push(availableKeys.length === 0 ? "Available settings: (none)" : "Available settings:");
  if (availableKeys.length > 0) lines.push(markdownList(availableKeys.sort()));

  agent.chatOutput(lines.join("\n"));
}
