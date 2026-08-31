import type { TreeLeaf } from "@tokenring-ai/agent/question";
import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import { ChatModelRegistry } from "@tokenring-ai/ai-client/ModelRegistry";
import type { ModelSettings } from "@tokenring-ai/ai-client/schema.client";
import { serializeModel } from "@tokenring-ai/ai-client/util/modelSettings";
import EnhancedStringMap from "@tokenring-ai/utility/map/enhancedStringMap";
import { ChatService } from "../../../../index.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

async function execute({ agent }: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const chatService = agent.requireService(ChatService);
  const { base, settings } = chatService.getModelAndSettings(agent);
  const client = agent.requireService(ChatModelRegistry).getClient(base);
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
    const newSettings: ModelSettings = new EnhancedStringMap();
    for (const k of selection) newSettings.set(k, true);
    const newModel = serializeModel(base, newSettings);
    chatService.setModel(newModel, agent);
    return `Settings updated. New model: ${newModel}`;
  }
  return "Feature selection cancelled. No changes made.";
}

export default {
  name: "chat model settings select",
  alias: "model settings",
  description: "Interactively select model settings",
  inputSchema,
  execute,
  help: `Open an interactive selector to choose which feature flags to enable for the current model.

## Example
/chat model settings select
/model settings`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
