import {Agent} from "@tokenring-ai/agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";
import {FeatureOptions} from "@tokenring-ai/ai-client/ModelTypeRegistry";
import {createChatRequest} from "../chatRequestBuilder/createChatRequest.ts";
import ChatService from "../ChatService.ts";
import runChat from "../runChat.ts";
import {outputChatAnalytics} from "../util/outputChatAnalytics.ts";

const description =
  "/chat - Send messages and manage chat AI settings";

async function execute(remainder: string, agent: Agent): Promise<void> {
  const chatService = agent.requireServiceByType(ChatService);
  const trimmed = remainder?.trim() || "";
  const parts = trimmed.split(/\s+/);
  const subCommand = parts[0]?.toLowerCase();

  // Handle subcommands
  if (subCommand === "settings") {
    return handleSettingsSubcommand(parts.slice(1), agent, chatService);
  }

  if (subCommand === "feature") {
    return handleFeatureSubcommand(parts.slice(1), agent);
  }

  if (subCommand === "context") {
    return showContext(agent);
  }

  if (subCommand === "send") {
    const message = trimmed.substring("send".length).trim();
    return sendMessage(message, agent, chatService);
  }

  // No subcommand - show help
  if (!trimmed) {
    agent.infoLine("Usage:");
    agent.infoLine("  /chat send <message>     - Send a message to the AI");
    agent.infoLine("  /chat settings [key=val] - View or update AI settings");
    agent.infoLine("  /chat feature <action>   - Manage model features");
    agent.infoLine("  /chat context            - Show current context");
    agent.infoLine("\nType /help chat for detailed documentation.");
    return;
  }

  // Default: treat as send command for convenience
  return sendMessage(trimmed, agent, chatService);
}

async function sendMessage(message: string, agent: Agent, chatService: ChatService): Promise<void> {
  if (!message) {
    agent.infoLine("Please enter a message to send to AI, or type /help chat for available commands.");
    return;
  }

  const chatConfig = chatService.getChatConfig(agent);
  const [_output, response] = await runChat(message, chatConfig, agent);
  outputChatAnalytics(response, agent);
}

async function handleSettingsSubcommand(
  args: string[],
  agent: Agent,
  chatService: ChatService
): Promise<void> {
  if (args.length === 0) {
    // Show current settings
    const config = chatService.getChatConfig(agent);
    agent.infoLine("Current AI settings:");
    Object.entries(config).forEach(([key, value]) => {
      agent.infoLine(`  ${key}: ${value}`);
    });
    return;
  }

  const updates: Record<string, any> = {};

  for (const part of args) {
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
      "Usage: /chat feature <list|enable|disable> [key[=value] ...]",
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
      agent.errorLine("/chat feature enable requires at least one key or key=value");
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
    agent.errorLine("/chat feature disable requires at least one key");
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
    const chatConfig = chatService.getChatConfig(agent);

    const request = await createChatRequest(
      "dummy_input",
      {
        ...chatConfig,
        enabledTools: []
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

const help: string = `# /chat - Send messages and manage chat AI settings

## /chat [message] or /chat send <message>

Send a message to the AI chat service. This is the primary command for communicating with the AI, using your selected model and current context.

### Examples

/chat Hello, how are you?          # Send a simple message
/chat send Explain quantum computing  # Explicit send subcommand

### Features

- Uses your selected AI model (see \`/model\`)
- Includes conversation context and system prompts
- Provides available tools if enabled (see \`/tools\`)
- Shows detailed token usage analytics after completion

---

## /chat settings [key=value ...]

Configure AI model settings and behavior. With no arguments, shows current configuration.

### Available Settings

- **temperature=0.7** - Controls randomness (0.0-2.0, default: 1.0)
- **maxTokens=1000** - Maximum response length (integer)
- **topP=0.9** - Nucleus sampling threshold (0.0-1.0)
- **frequencyPenalty=0.0** - Reduce repetition (-2.0 to 2.0)
- **presencePenalty=0.0** - Encourage new topics (-2.0 to 2.0)
- **stopSequences=a,b,c** - Stop at these sequences
- **autoCompact=true** - Enable automatic context compaction

### Examples

/chat settings                              # Show current settings
/chat settings temperature=0.5 maxTokens=2000
/chat settings autoCompact=true

---

## /chat feature <list|enable|disable> [key[=value] ...]

Manage model feature flags that enable special capabilities.

### /chat feature list

List currently enabled and available features for your model.

### /chat feature enable key[=value] [...]

Enable or set model feature flags.

#### Value Types

- **Boolean**: true/false, 1/0
- **Number**: Numeric values
- **String**: Text values

#### Examples

/chat feature enable reasoning
/chat feature enable temperature=0.7

### /chat feature disable key [...]

Remove/disable specific feature flags.

#### Examples

/chat feature disable reasoning

---

## /chat context

Display all context items that would be included in a chat request. Useful for debugging and understanding what information the AI has access to.

### Shows

- Total number of context messages
- System prompt configuration
- Previous conversation messages (with preview)

**Note:** Context display shows the exact data sent to the AI model.`;

export default {
  description,
  execute,
  help,
} as TokenRingAgentCommand;