import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";
import ChatService from "../ChatService.ts";

interface TreeNode {
  name: string;
  value?: string;
  children?: TreeNode[];
  hasChildren?: boolean;
}

const description: string =
  "/model - Set or show the target model for chat";

async function execute(remainder: string, agent: Agent): Promise<void> {
  const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);
  const chatService = agent.requireServiceByType(ChatService);

  const model = chatService.getModel(agent);

  // Handle direct model name input, e.g. /model gpt-4
  const directModelName = remainder?.trim();
  if (directModelName) {
    chatService.setModel(directModelName, agent);
    agent.infoLine(`Model set to ${directModelName}`);
    return;
  }

  // If no remainder provided, show interactive tree selection grouped by provider
  const modelsByProvider = await agent.busyWhile(
    "Checking online status of models...",
    chatModelRegistry.getModelsByProvider(),
  );

  // Build tree structure for model selection
  const buildModelTree = (): TreeNode => {
    const tree: TreeNode = {
      name: "Model Selection",
      children: [],
    };

    const sortedProviders = Object.entries(modelsByProvider).sort(([a], [b]) =>
      a.localeCompare(b),
    );

    for (const [provider, providerModels] of sortedProviders) {
      // Sort models by status (online first) then by name
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

      // Count online models for provider display
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

  // Interactive tree selection if no model name is provided in the command
  try {
    const selectedModel = await agent.askHuman({
      type: "askForSingleTreeSelection",
      message: `Current model: ${model}. Choose a new model:`,
      tree: buildModelTree(),
    });

    if (selectedModel) {
      chatService.setModel(selectedModel, agent);
      agent.infoLine(`Model set to ${selectedModel}`);
    } else {
      agent.infoLine("Model selection cancelled. No changes made.");
    }
  } catch (error) {
    agent.errorLine(`Error during model selection:`, error as Error);
  }
}

const help: string = `# /model [model_name]

Set or display the AI model used for chat responses. Choose from available models based on your needs for speed, quality, and cost.

## Usage

/model                    # Interactive model selection (recommended)
/model gpt-4              # Set to specific model
/model auto               # Auto-select best available model
/model auto:reasoning     # Auto-select with reasoning capabilities
/model auto:frontier      # Auto-select latest frontier model

## Interactive Mode

- Models are grouped by provider (OpenAI, Anthropic, etc.)
- Status indicators show availability:
  - ✅ Online - Ready for immediate use
  - 🧊 Cold - May have startup delay
  - 🔴 Offline - Currently unavailable
- Current model is highlighted

## Special Values

- **auto** - Automatically selects best available model
- **auto:reasoning** - Prefers models with advanced reasoning
- **auto:frontier** - Prefers latest cutting-edge models

## Examples

/model                    # Browse and select model interactively
/model gpt-4-turbo        # Use GPT-4 Turbo for better performance
/model claude-3-sonnet    # Use Claude 3 Sonnet for balanced quality
/model auto               # Let system choose best model

**Note:** Model availability and performance may vary based on your subscription level and current server load.`;
export default {
  description,
  execute,
  help,
} as TokenRingAgentCommand;