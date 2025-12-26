import Agent from "@tokenring-ai/agent/Agent";
import ChatService from "../../ChatService.ts";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";

interface TreeNode {
  name: string;
  value?: string;
  children?: TreeNode[];
  hasChildren?: boolean;
}

export default async function select(_remainder: string, agent: Agent): Promise<void> {
  const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);
  const chatService = agent.requireServiceByType(ChatService);

  const modelsByProvider = await agent.busyWhile(
    "Checking online status of models...",
    chatModelRegistry.getModelsByProvider(),
  );

  const buildModelTree = (): TreeNode => {
    const tree: TreeNode = {
      name: "Model Selection",
      children: [],
    };

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

      tree.children?.push({
        name: `${provider} (${onlineCount}/${totalCount} online)`,
        hasChildren: true,
        children,
      });
    }

    return tree;
  };

  const selectedModel = await agent.askHuman({
    type: "askForSingleTreeSelection",
    title: "Model Selection",
    message: `Choose a new model:`,
    tree: buildModelTree(),
  });

  if (selectedModel) {
    chatService.setModel(selectedModel, agent);
    agent.infoLine(`Model set to ${selectedModel}`);
  } else {
    agent.infoLine("Model selection cancelled. No changes made.");
  }
}
