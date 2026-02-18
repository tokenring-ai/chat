import Agent from "@tokenring-ai/agent/Agent";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";
import markdownList from "@tokenring-ai/utility/string/markdownList";
import {getModelAndSettings} from "./util.ts";

export default async function show(_remainder: string, agent: Agent): Promise<void> {
  agent.infoMessage("Showing current settings");
  try {
    const {currentModel, base, settings} = getModelAndSettings(agent);
    const lines: string[] = [`Current model: ${currentModel}`, `Base model: ${base}`];

    const keys = Object.keys(settings);
    if (keys.length === 0) {
      lines.push("Enabled settings: (none)");
    } else {
      lines.push("Enabled settings:");
      lines.push(markdownList(keys.sort().map(k => `${k}: ${settings[k]}`)));
    }

    try {
      const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);
      const client = await chatModelRegistry.getClient(base);
      const availableKeys = Object.keys(client.getModelSpec().settings || {});
      lines.push(availableKeys.length === 0 ? "Available settings: (none)" : "Available settings:");
      if (availableKeys.length > 0) lines.push(markdownList(availableKeys.sort()));
    } catch (error) {
      lines.push(`Available settings: (could not fetch model spec: ${error})`);
    }

    agent.infoMessage(lines.join("\n"));
  } catch (error) {
    agent.errorMessage(`Error fetching settings: ${error}`);
  }
}
