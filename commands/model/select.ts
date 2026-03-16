import Agent from "@tokenring-ai/agent/Agent";
import type {TreeLeaf} from "@tokenring-ai/agent/question";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";
import ChatService from "../../ChatService.ts";

async function execute(_remainder: string, agent: Agent): Promise<string> {
  const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);
  const chatService = agent.requireServiceByType(ChatService);
  const modelsByProvider = await agent.busyWithActivity("Checking online status of models...", chatModelRegistry.getModelsByProvider());
  const tree: TreeLeaf[] = Object.entries(modelsByProvider)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([provider, providerModels]) => {
      const sorted = Object.entries(providerModels).sort(([, a], [, b]) =>
        a.status === b.status ? a.modelSpec.modelId.localeCompare(b.modelSpec.modelId) : a.status.localeCompare(b.status)
      );
      const onlineCount = Object.values(providerModels).filter(m => m.status === "online").length;
      return {
        name: `${provider} (${onlineCount}/${Object.keys(providerModels).length} online)`,
        children: sorted.map(([modelName, model]) => ({
          value: modelName,
          name: model.status === "online" ? model.modelSpec.modelId : `${model.modelSpec.modelId} (${model.status})`,
        })),
      };
    });
  const selection = await agent.askQuestion({
    message: `Choose a new model:`,
    question: { type: 'treeSelect', label: "Model Selection", key: "result", minimumSelections: 1, maximumSelections: 1, tree },
  });
  if (selection) {
    chatService.setModel(selection[0], agent);
    return `Model set to ${selection[0]}`;
  }
  return "Model selection cancelled. No changes made.";
}

export default {
  name: "model select", description: "Interactively select a model", help: `# /model select

Open an interactive tree-based selector to choose a chat model. Models are grouped by provider with availability status.

## Example

/model select`, execute } satisfies TokenRingAgentCommand;
