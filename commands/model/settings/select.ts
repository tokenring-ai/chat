import type { TreeLeaf } from "@tokenring-ai/agent/question";
import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import { ChatModelRegistry } from "@tokenring-ai/ai-client/ModelRegistry";
import { serializeModel } from "@tokenring-ai/ai-client/util/modelSettings";
import { ChatService } from "../../../index.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

async function execute({ agent }: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const chatService = agent.requireServiceByType(ChatService);
  const { base, settings } = chatService.getModelAndSettings(agent);
  const client = agent.requireServiceByType(ChatModelRegistry).getClient(base);
  const availableKeys = Object.keys(client.getModelSpec().settings || {});
  if (availableKeys.length === 0) return "No selectable settings available for this model.";
  const tree: TreeLeaf[] = availableKeys.sort().map(k => ({ name: k, value: k }));
  const currentEnabled = Object.keys(settings).filter(k => settings.get(k) === true);
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
    const newSettings = new Map<string, any>();
    for (const k of selection) newSettings.set(k, true);
    const newModel = serializeModel(base, newSettings);
    chatService.setModel(newModel, agent);
    return `Settings updated. New model: ${newModel}`;
  }
  return "Feature selection cancelled. No changes made.";
}

export default {
  name: "model settings select",
  description: "Interactively select model settings",
  inputSchema,
  execute,
  help: `Open an interactive selector to choose which feature flags to enable for the current model.

## Example

/model settings select`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
