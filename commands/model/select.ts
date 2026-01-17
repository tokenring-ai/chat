import Agent from "@tokenring-ai/agent/Agent";
import type {TreeLeaf} from "@tokenring-ai/agent/question";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";
import ChatService from "../../ChatService.ts";

export default async function select(_remainder: string, agent: Agent): Promise<void> {
  const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);
  const chatService = agent.requireServiceByType(ChatService);

  const modelsByProvider = await agent.busyWhile(
    "Checking online status of models...",
    chatModelRegistry.getModelsByProvider(),
  );

  const buildModelTree = (): TreeLeaf[] => {
    const roots: TreeLeaf[] = [];

    const sortedProviders = Object.entries(modelsByProvider).sort(([a], [b]) =>
      a.localeCompare(b),
    );

    for (const [provider, providerModels] of sortedProviders) {
      const sortedModels = Object.entries(providerModels).sort(
        ([, a], [, b]) => {
          if (a.status === b.status) {
            return a.modelSpec.modelId.localeCompare(b.modelSpec.modelId);
          } else {
            return a.status.localeCompare(b.status);
          }
        },
      );

      const children = sortedModels.map(([modelName, model]) => ({
        value: modelName,
        name:
          model.status === "online"
            ? model.modelSpec.modelId
            : model.status === "cold"
              ? `${model.modelSpec.modelId} (cold)`
              : `${model.modelSpec.modelId} (offline)`,
      }));

      const onlineCount = Object.values(providerModels).filter(
        (m) => m.status === "online",
      ).length;
      const totalCount = Object.keys(providerModels).length;

      roots.push({
        name: `${provider} (${onlineCount}/${totalCount} online)`,
        children,
      });
    }

    return roots;
  };

  const selection = await agent.askQuestion({
    message: `Choose a new model:`,
    question: {
      type: 'treeSelect',
      label: "Model Selection",
      key: "result",
      minimumSelections: 1,
      maximumSelections: 1,
      tree: buildModelTree(),
    }
  });

  if (selection) {
    const selectedModel = selection[0];
    chatService.setModel(selectedModel, agent);
    agent.infoMessage(`Model set to ${selectedModel}`);
  } else {
    agent.infoMessage("Model selection cancelled. No changes made.");
  }
}
