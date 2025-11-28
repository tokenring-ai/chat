import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";
import {FeatureOptions} from "@tokenring-ai/ai-client/ModelTypeRegistry";
import {createChatRequest} from "../chatRequestBuilder/createChatRequest.ts";
import ChatService from "../ChatService.ts";

const description: string = "/ai - Manage AI settings";

async function execute(remainder: string, agent: Agent): Promise<void> {
  const chatService = agent.requireServiceByType(ChatService);

  if (!remainder?.trim()) {
    // Show current settings
    const config = chatService.getChatConfig(agent);
    agent.infoLine("Current AI settings:");
    Object.entries(config).forEach(([key, value]) => {
      agent.infoLine(`  ${key}: ${value}`);
    });
    return;
  }

  const parts = remainder.trim().split(/\s+/);

  // /ai feature <list|enable|disable> ...
  if (parts[0] === "feature") {
    return handleFeatureSubcommand(parts.slice(1), agent);
  }

  if (parts[0] === "context") {
    await showContext(agent);
    return;
  }

  if (parts[0] !== "settings") {
    agent.errorLine(
      "Usage: /ai settings key=value [key=value...] | /ai context | /ai feature <list|enable|disable>",
    );
    return;
  }

  const updates: Record<string, any> = {};

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const [key, value] = part.split("=");

    if (!key || value === undefined) {
      agent.errorLine(`Invalid format: ${part}. Use key=value`);
      continue;
    }

    // Parse value based on key type
    let parsedValue: any = value;
    if (
      key === "temperature" ||
      key === "topP" ||
      key === "frequencyPenalty" ||
      key === "presencePenalty"
    ) {
      parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) {
        agent.errorLine(`Invalid number for ${key}: ${value}`);
        continue;
      }
    } else if (key === "maxTokens") {
      parsedValue = parseInt(value);
      if (isNaN(parsedValue)) {
        agent.errorLine(`Invalid integer for ${key}: ${value}`);
        continue;
      }
    } else if (key === "stopSequences") {
      parsedValue = value.split(",");
    } else if (key === "autoCompact") {
      parsedValue = value.toLowerCase() === "true";
    }

    updates[key] = parsedValue;
  }

  if (Object.keys(updates).length > 0) {
    chatService.updateChatConfig(updates, agent);
    agent.infoLine(`Updated AI settings: ${Object.keys(updates).join(", ")}`);
  }
}

function parseModelAndFeatures(model: string): { base: string; features: FeatureOptions } {
  const qIndex = model.indexOf("?");
  const base = qIndex >= 0 ? model.substring(0, qIndex) : model;
  const features: FeatureOptions = Object.create(null);
  if (qIndex >= 0) {
    const query = model.substring(qIndex + 1);
    for (const part of query.split("&")) {
      if (!part) continue;
      const [rawK, rawV] = part.split("=");
      const k = decodeURIComponent(rawK);
      const v = rawV === undefined ? "1" : decodeURIComponent(rawV);
      features[k] = coerceFeatureValue(v);
    }
  }
  return {base, features};
}

function coerceFeatureValue(v: string): any {
  const lower = v.toLowerCase?.();
  if (v === "1" || lower === "true") return true;
  if (v === "0" || lower === "false") return false;
  const asNum = Number(v);
  if (!Number.isNaN(asNum) && String(asNum) === v.replace(/(?<=\d)\.0+$/, (m) => m)) {
    return asNum;
  }
  return v;
}

function serializeModel(base: string, features: FeatureOptions): string {
  const entries = Object.entries(features).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return base;
  const query = entries
    .map(([k, v]) => {
      let val: string;
      if (typeof v === "boolean") val = v ? "1" : "0";
      else val = String(v);
      return `${encodeURIComponent(k)}=${encodeURIComponent(val)}`;
    })
    .join("&");
  return `${base}?${query}`;
}

async function handleFeatureSubcommand(args: string[], agent: Agent): Promise<void> {
  const chatService = agent.requireServiceByType(ChatService);
  const currentModel = chatService.getModel(agent);
  const {base, features} = parseModelAndFeatures(currentModel);

  const action = args[0];
  if (!action || !["list", "enable", "disable"].includes(action)) {
    agent.errorLine(
      "Usage: /ai feature <list|enable|disable> [key[=value] ...]",
    );
    return;
  }

  if (action === "list") {
    agent.infoLine(`Current model: ${currentModel}`);
    agent.infoLine(`Base model: ${base}`);

    // Show enabled features
    const keys = Object.keys(features);
    if (keys.length === 0) {
      agent.infoLine("Enabled features: (none)");
    } else {
      agent.infoLine("Enabled features:");
      for (const k of keys.sort()) {
        agent.infoLine(`  ${k}: ${features[k]}`);
      }
    }

    // Show available features from the model spec
    try {
      const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);
      const client = await chatModelRegistry.getFirstOnlineClient(base);
      const modelSpec = client.getModelSpec();
      const availableFeatures = modelSpec.features || {};
      const availableKeys = Object.keys(availableFeatures);

      if (availableKeys.length === 0) {
        agent.infoLine("Available features: (none)");
      } else {
        agent.infoLine("Available features:");
        for (const k of availableKeys.sort()) {
          agent.infoLine(`  ${k}`);
        }
      }
    } catch (error) {
      agent.infoLine(`Available features: (could not fetch model spec: ${error})`);
    }

    return;
  }

  if (action === "enable") {
    if (args.length < 2) {
      agent.errorLine("/ai feature enable requires at least one key or key=value");
      return;
    }
    for (let i = 1; i < args.length; i++) {
      const token = args[i];
      const eq = token.indexOf("=");
      if (eq === -1) {
        features[token] = true;
      } else {
        const key = token.substring(0, eq);
        const val = token.substring(eq + 1);
        if (!key) {
          agent.errorLine(`Invalid feature token: ${token}`);
          continue;
        }
        features[key] = coerceFeatureValue(val);
      }
    }
    const newModel = serializeModel(base, features);
    chatService.setModel(newModel, agent);
    agent.infoLine(`Enabled features. New model: ${newModel}`);
    return;
  }

  // disable
  if (args.length < 2) {
    agent.errorLine("/ai feature disable requires at least one key");
    return;
  }
  for (let i = 1; i < args.length; i++) {
    const key = args[i];
    if (!key) continue;
    delete features[key];
  }
  const newModel = serializeModel(base, features);
  chatService.setModel(newModel, agent);
  agent.infoLine(`Disabled features. New model: ${newModel}`);
}

async function showContext(agent: Agent): Promise<void> {
  try {
    const chatService = agent.requireServiceByType(ChatService);
    const config = chatService.getChatConfig(agent);

    const systemPrompt =
      typeof config.systemPrompt === "function"
        ? config.systemPrompt()
        : config.systemPrompt;

    const request = await createChatRequest(
      {
        input: "dummy input",
        systemPrompt,
        includeContextItems: true,
        includeTools: false,
        includePriorMessages: true,
      },
      agent,
    );

    agent.infoLine("Context items that would be added to chat request:");
    agent.infoLine(`Total messages: ${request.messages.length}`);

    request.messages.slice(0, -1).forEach((msg, index) => {
      const content =
        typeof msg.content === "string"
          ? msg.content
            ? Array.isArray(msg.content)
              ? msg.content[0].text
              : msg.content
            : msg.content
          : JSON.stringify(msg.content);
      const preview =
        content.length > 100 ? content.substring(0, 130) + "..." : content;
      agent.infoLine(`${index + 1}. [${msg.role}] ${preview}`);
    });
  } catch (error) {
    agent.errorLine(`Error building context: ${error}`);
  }
}

const help: string = `# /ai - Manage AI settings

## /ai settings key=value [key=value...]

Configure AI model settings and behavior. These settings affect how the AI processes your requests and generates responses.

### Available Settings

- **temperature=0.7** - Controls randomness (0.0-2.0, default: 1.0)
- **maxTokens=1000** - Maximum response length (integer)
- **topP=0.9** - Nucleus sampling threshold (0.0-1.0)
- **frequencyPenalty=0.0** - Reduce repetition (-2.0 to 2.0)
- **presencePenalty=0.0** - Encourage new topics (-2.0 to 2.0)
- **stopSequences=a,b,c** - Stop at these sequences
- **autoCompact=true** - Enable automatic context compaction

### Examples

/ai settings temperature=0.5 maxTokens=2000
/ai settings frequencyPenalty=0.2 presencePenalty=0.1
/ai settings autoCompact=true

With no arguments: Shows current AI configuration

## /ai feature list

List currently enabled model features and available features supported by your current model. Features enable special capabilities like reasoning, code execution, or specific output formats.

### Output includes

- Current model with enabled features
- Base model name
- All currently active feature flags
- Available features from model specification

## /ai feature enable key[=value] [key[=value] ...]

Enable or set model feature flags. Features provide enhanced capabilities and behaviors for specific models. Feature values are automatically parsed based on type.

### Value Types

- **Boolean**: true/false, 1/0
- **Number**: Numeric values (temperature, max tokens, etc.)
- **String**: Text values (custom parameters)

### Examples

/ai feature enable reasoning          # Enable reasoning feature
/ai feature enable temperature=0.7    # Set temperature via feature
/ai feature enable custom_param=value # Set custom parameter

## /ai feature disable key [key ...]

Remove/disable specific feature flags from your current model. This simplifies the model string and removes unwanted capabilities.

### Examples

/ai feature disable reasoning         # Disable reasoning
/ai feature disable temperature      # Remove temperature setting
/ai feature disable custom_param     # Remove custom parameter

## /ai context

Display all context items that would be included in a chat request. This is useful for debugging and understanding what information the AI has access to during conversations.

### Shows

- Total number of context messages
- System prompt configuration
- Previous conversation messages (with preview)
- Any context items or tools

### Output Format

- \`1. [role] message content preview\`
- Long messages are truncated with '...'
- Messages are numbered for easy reference

### Common Use Cases

- Debug context issues in long conversations
- Verify system prompt is being used correctly
- Check what previous messages are included
- Understand token usage composition

**Note:** Context display shows the exact data sent to the AI model.`;
export default {
  description,
  execute,
  help,
} as TokenRingAgentCommand;