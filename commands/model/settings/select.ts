import Agent from "@tokenring-ai/agent/Agent";
import type {TreeLeaf} from "@tokenring-ai/agent/question";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";
import {getModelAndSettings, serializeModel} from "./util.ts";

export default async function select(_remainder: string, agent: Agent): Promise<void> {
  const {chatService, base, settings} = getModelAndSettings(agent);

  let availableKeys: string[] = [];
  try {
    const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);
    const client = await chatModelRegistry.getClient(base);
    availableKeys = Object.keys(client.getModelSpec().settings || {});
  } catch {
    agent.errorMessage("Could not fetch available settings for this model.");
    return;
  }

  if (availableKeys.length === 0) {
    agent.infoMessage("No selectable settings available for this model.");
    return;
  }

  const tree: TreeLeaf[] = availableKeys.sort().map(k => ({ name: k, value: k }));
  const currentEnabled = Object.keys(settings).filter(k => settings[k] === true);

  const selection = await agent.askQuestion({
    message: "Choose settings to enable:",
    question: {
      type: "treeSelect",
      label: "Feature Selection",
      key: "result",
      defaultValue: currentEnabled,
      minimumSelections: 0,
      tree,
    },
  });

  if (selection) {
    const newSettings = Object.create(null);
    for (const k of selection) newSettings[k] = true;
    const newModel = serializeModel(base, newSettings);
    chatService.setModel(newModel, agent);
    agent.infoMessage(`Settings updated. New model: ${newModel}`);
  } else {
    agent.infoMessage("Feature selection cancelled. No changes made.");
  }
}
