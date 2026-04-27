# @tokenring-ai/chat

## Overview

Tool calling AI chat client for the TokenRing ecosystem. This package provides a comprehensive chat interface for AI-powered conversations with advanced features like context management, tool integration, and interactive command-line controls. It integrates seamlessly with the Token Ring application framework and supports multiple AI providers.

## Key Features

- **Multi-Provider Support**: Works with various AI model providers (OpenAI, Anthropic, Google, Groq, etc.) via `@tokenring-ai/ai-client`
- **Context Management**: Intelligent context handling with automatic compaction and customizable context sources
- **Tool Integration**: Extensible tool system with plugin architecture and wildcard matching
- **Hidden Tools**: Ability to hide tools from the model while keeping them available, with search functionality via `tool_search`
- **Interactive Commands**: Rich command set for chat management including `/chat`, `/model`, `/tools`, and `/compact`
- **State Persistence**: Persistent chat history with message history management and message stack for undo operations
- **Interactive Selection**: Tree-based UI for model and tool selection
- **Feature Flags**: Advanced model feature flags and capabilities via `/model settings`
- **Context Debugging**: Display and inspect chat context for transparency with `/chat context`
- **Type-Safe Configuration**: Zod-based schema validation for all configuration options
- **Comprehensive Error Handling**: Clear error messages for configuration and operation issues
- **RPC Endpoints**: Remote procedure call support for chat management
- **Tool Call Artifacts**: Automatic output of tool call requests and responses as artifacts
- **Parallel/Sequential Tool Execution**: Configurable tool execution mode with queue-based processing
- **Token Usage Analytics**: Detailed breakdown of input/output tokens, costs, and timing
- **Hook System**: Extensible lifecycle hooks for post-chat completion processing
- **Attachment Support**: Support for text, image, and file attachments in chat messages
- **Dynamic System Prompts**: Support for function-based system prompts with variable interpolation

## Installation

```bash
bun install @tokenring-ai/chat
```

## Core Components

### ChatService

The main service class for managing AI chat functionality. Implements `TokenRingService` and provides comprehensive chat management capabilities.

```typescript
import ChatService from "@tokenring-ai/chat";

const chatService = new ChatService(app, options);
```

#### Constructor

| Parameter | Type                                       | Description              |
|-----------|--------------------------------------------|--------------------------|
| `app`     | TokenRingApp                               | The application instance |
| `options` | `z.output<typeof ChatServiceConfigSchema>` | Configuration options    |

#### Properties

| Property       | Type               | Description                    |
|----------------|--------------------|--------------------------------|
| `name`         | `"ChatService"`    | Service name identifier        |
| `description`  | `string`           | Service description            |
| `app`          | `TokenRingApp`     | Application instance reference |
| `options`      | `ParsedChatConfig` | Configuration options          |
| `defaultModel` | `string \| null`   | Selected default model         |

#### Methods

##### Service Lifecycle

| Method                           | Description                                       |
|----------------------------------|---------------------------------------------------|
| `start()`                        | Initialize the service and select default model   |
| `attach(agent, creationContext)` | Attach service to agent with state initialization |

##### Model Management

| Method                                        | Description                                                |
|-----------------------------------------------|------------------------------------------------------------|
| `setModel(model: string, agent: Agent): void` | Set the AI model for the agent                             |
| `getModel(agent: Agent): string \| null`      | Get the current model name or null                         |
| `requireModel(agent: Agent): string`          | Get the current model or throw an error if not set         |
| `getModelAndSettings(agent: Agent)`           | Get model and settings using `getModelAndSettings` utility |

##### Configuration Management

| Method                                                                      | Description                               |
|-----------------------------------------------------------------------------|-------------------------------------------|
| `getChatConfig(agent: Agent): ParsedChatConfig`                             | Get current chat configuration            |
| `updateChatConfig(aiConfig: Partial<ParsedChatConfig>, agent: Agent): void` | Update configuration with partial updates |

##### Message History Management

| Method                                                            | Description                    |
|-------------------------------------------------------------------|--------------------------------|
| `getChatMessages(agent: Agent): StoredChatMessage[]`              | Get all chat messages          |
| `getLastMessage(agent: Agent): StoredChatMessage \| null`         | Get the last message or null   |
| `pushChatMessage(message: StoredChatMessage, agent: Agent): void` | Add a message to history       |
| `clearChatMessages(agent: Agent): Promise<void>`                  | Clear all messages             |
| `popMessage(agent: Agent): void`                                  | Remove the last message (undo) |

##### Tool Management

| Method                                                          | Description                                         |
|-----------------------------------------------------------------|-----------------------------------------------------|
| `addTools(...tools: TokenRingToolDefinition<any>[])`            | Register one or more tools                          |
| `getAvailableToolNames(): string[]`                             | Get all available tool names                        |
| `getAvailableToolEntries()`                                     | Get all available tool definitions as entries       |
| `getToolNamesLike(pattern: string): string[]`                   | Get tool names matching a pattern                   |
| `ensureToolNamesLike(pattern: string): string[]`                | Expand wildcard patterns to tool names              |
| `getEnabledTools(agent: Agent): string[]`                       | Get enabled tool names                              |
| `getHiddenTools(agent: Agent): string[]`                        | Get hidden tool names                               |
| `setEnabledTools(toolNames: string[], agent: Agent): string[]`  | Set exactly enabled tools                           |
| `enableTools(toolNames: string[], agent: Agent): string[]`      | Enable additional tools                             |
| `disableTools(toolNames: string[], agent: Agent): string[]`     | Disable tools                                       |
| `hideTools(toolNames: string[], agent: Agent): string[]`        | Hide tools (remove from enabled but keep available) |
| `requireTool(toolName: string): NamedTool`                      | Get a tool by name                                  |

##### Context Handler Management

| Method                                                                    | Description                             |
|---------------------------------------------------------------------------|-----------------------------------------|
| `getContextHandlerByName(name: string): ContextHandler \| undefined`      | Get a context handler by name           |
| `requireContextHandlerByName(name: string): ContextHandler`               | Get a context handler or throw an error |
| `registerContextHandler(name: string, handler: ContextHandler): void`     | Register a single context handler       |
| `registerContextHandlers(handlers: Record<string, ContextHandler>): void` | Register multiple context handlers      |

##### Message Building

| Method                                                                         | Description                                       |
|--------------------------------------------------------------------------------|---------------------------------------------------|
| `buildChatMessages(options: BuildChatMessagesOptions): Promise<ContextItem[]>` | Build chat request messages from context handlers |

##### Compaction Management

| Method                                                                     | Description                                  |
|----------------------------------------------------------------------------|----------------------------------------------|
| `getPendingCompaction(agent: Agent): StoredChatCompaction \| null`         | Get pending compaction state                 |
| `hasPendingCompaction(agent: Agent): boolean`                              | Check if there is pending compaction         |
| `isCompactionInProgress(agent: Agent): boolean`                            | Check if compaction is currently in progress |
| `applyPendingCompaction(agent: Agent): boolean`                            | Apply pending compaction to current message  |
| `stageContextCompaction(compactionConfig, agent: Agent): Promise<boolean>` | Stage a compaction for later application     |
| `compactContext(compactionConfig, agent: Agent): Promise<void>`            | Perform immediate context compaction         |

### ChatServiceState

The state management class that tracks chat state for each agent:

**State Properties:**

- `currentConfig`: Current chat configuration (model, tools, context settings, etc.)
- `messages`: Array of chat messages with timestamps
- `parallelTools`: Boolean flag for parallel/sequential tool execution mode
- `toolQueue`: Async queue for sequential tool execution
- `injectedMessages`: Array of injected messages for special purposes
- `pendingCompaction`: Staged compaction waiting to be applied
- `compactionInProgress`: Flag indicating if compaction is currently running

**Methods:**

- `serialize()`: Serialize state for persistence
- `deserialize(data)`: Deserialize state from persistence
- `show()`: Return array of strings for display in agent UI
- `resetSettings()`: Reset configuration to initial values
- `resetChat()`: Clear all chat messages
- `runToolMaybeInParallel(executeToolFunction)`: Execute tool with parallel/sequential mode

**State Persistence:**

- State is persisted across agent sessions
- Uses Zod schema for type-safe serialization/deserialization
- Registered with agent system via `attach()` method

### runChat

Core chat execution function that handles the complete chat lifecycle:

```typescript
import runChat from "@tokenring-ai/chat/runChat";

const response = await runChat({
  input: "Hello, how are you?",
  chatConfig: chatService.getChatConfig(agent),
  agent
});
```

**Features:**

- Automatic model selection and client management with retry logic
- Context building from handlers
- Tool execution with parallel/sequential support
- Max steps enforcement with user approval
- Automatic context compaction when threshold exceeded
- Message history management
- Integration with agent lifecycle hooks
- Hook execution via `AfterChatCompletion` event
- Auto-activation of tools with `adjustActivation` flag

## Chat Commands

The package provides the following chat commands, organized by category:

### Chat Management Commands

| Command                      | Description                              |
|------------------------------|------------------------------------------|
| `/chat send message`         | Send a message to the AI                 |
| `/chat context`              | Display current chat context             |
| `/chat compact [focus]`      | Compact conversation context             |
| `/chat reset`                | Reset the chat context                   |

### Model Management Commands

| Command                          | Description                              |
|----------------------------------|------------------------------------------|
| `/model get`                     | Show current model                       |
| `/model set modelName`           | Set the chat model                       |
| `/model select`                  | Interactive model selection              |
| `/model reset`                   | Reset to initial model                   |
| `/model settings show`           | Show model settings                      |
| `/model settings set key=value`  | Set a model setting                      |
| `/model settings select`         | Interactive settings selection           |
| `/model settings enable keys`    | Enable model settings                    |
| `/model settings disable keys`   | Disable model settings                   |

### Tool Management Commands

| Command                      | Description                              |
|------------------------------|------------------------------------------|
| `/tools list`                | List enabled tools                       |
| `/tools enable toolNames`    | Enable tools                             |
| `/tools disable toolNames`   | Disable tools                            |
| `/tools set toolNames`       | Set exactly which tools are enabled      |
| `/tools select`              | Interactive tool selection               |
| `/tools hide toolNames`      | Hide tools from the model                |

## Chat Command Details

### /chat send message

Send a message to the AI chat service. This is the primary command for communicating with the AI, using your selected model and current context.

**Examples:**

```bash
/chat send Hello, how are you?
```

**Features:**

- Uses your selected AI model (see `/model`)
- Includes conversation context and system prompts
- Provides available tools if enabled (see `/tools`)
- Shows detailed token usage analytics after completion
- Supports attachments via `allowAttachments: true`

### /chat context

Display all context items that would be included in a chat request. Useful for debugging and understanding what information the AI has access to.

**Examples:**

```bash
/chat context
```

**Shows:**

- Total number of context messages
- System prompt configuration
- Previous conversation messages (with preview)

**Note:** Context display shows the exact data sent to the AI model.

### /chat compact [focus]

Compress the conversation context by creating intelligent summaries of prior messages. This helps reduce token usage and maintain context in long conversations.

**Examples:**

```bash
/chat compact
/chat compact specifics of the task at hand, including the goal and expected outcome
```

**How it works:**

- Analyzes all previous messages in the conversation
- Creates concise summaries while preserving key information
- Maintains conversation flow and important context
- Reduces token count for better performance and cost savings

**When to use:**

- After many messages have been exchanged
- When you notice responses getting slower
- When approaching token limits
- Before starting a new topic in a long conversation

**Benefits:**

- Faster response times in long conversations
- Lower API costs due to reduced token usage
- Maintains important context without losing information
- Prevents context overflow errors

### /chat reset

Reset the chat context, clearing prior messages and starting a new conversation.

**Examples:**

```bash
/chat reset
```

### /model get

Show the currently active chat model.

**Examples:**

```bash
/model get
```

### /model set modelName

Set the chat model to a specific model by name.

**Examples:**

```bash
/model set gpt-5.2
```

### /model select

Open an interactive tree-based selector to choose a chat model. Models are grouped by provider with availability status.

**Examples:**

```bash
/model select
```

### /model reset

Reset the chat model to the initial configured value.

**Examples:**

```bash
/model reset
```

### /model settings show

Show the currently enabled feature flags and all available settings for the current model.

**Examples:**

```bash
/model settings show
```

### /model settings set token

Set a single model feature flag.

**Examples:**

```bash
/model settings set websearch
/model settings set temperature=0.7
```

### /model settings select

Open an interactive selector to choose which feature flags to enable for the current model.

**Examples:**

```bash
/model settings select
```

### /model settings enable keys

Enable one or more model feature flags.

**Examples:**

```bash
/model settings enable reasoning
/model settings enable websearch temperature=0.7
```

### /model settings disable keys

Disable one or more model feature flags.

**Examples:**

```bash
/model settings disable reasoning
/model settings disable reasoning websearch
```

### /tools list

List all currently enabled tools.

**Examples:**

```bash
/tools list
```

### /tools enable toolNames

Enable one or more tools by name. Supports wildcard patterns.

**Examples:**

```bash
/tools enable web-search
/tools enable web-search calculator
```

### /tools disable toolNames

Disable one or more tools by name. Supports wildcard patterns.

**Examples:**

```bash
/tools disable calculator
/tools disable web-search calculator
```

### /tools set toolNames

Set exactly which tools are enabled, replacing the current selection. Supports wildcard patterns.

**Examples:**

```bash
/tools set web-search calculator
```

### /tools select

Open an interactive tree-based selector to choose which tools to enable. Tools are grouped by category.

**Examples:**

```bash
/tools select
```

### /tools hide toolNames

Hide one or more tools by name, requiring the model to search for the tool to activate it before use.

Saves context tokens; useful for agents that need access to large numbers of tools.

**Examples:**

```bash
/tools hide calculator
/tools hide web-search calculator
```

**Hidden Tools:**

Tools can be hidden to save context tokens. Hidden tools are not visible to the model but remain available. The `tool_search` tool is automatically enabled when hidden tools are configured and can be used to search for and enable hidden tools by regex pattern.

## Context Handlers

Context handlers build the AI chat request by gathering relevant information from various sources.

### Built-in Context Handlers

| Handler           | Description                                                                  |
|-------------------|------------------------------------------------------------------------------|
| `current-message` | Adds the current user input with attachment support                          |
| `prior-messages`  | Includes previous conversation history with intelligent truncation           |
| `system-message`  | Adds system prompts (supports dynamic system prompts via functions)          |
| `tool-context`    | Includes context from enabled tools based on their required context handlers |

### Context Handler Configuration

Context handlers can be configured with additional options:

- **current-message**: Supports `allowRemoteAttachments` (default: `true`) to control remote attachment handling
- **prior-messages**: Supports `maxMessages` (default: `1000`, min: `4`) to limit the number of prior messages included

### Custom Context Handlers

You can register custom context handlers to extend the context building process:

```typescript
import ChatService from "@tokenring-ai/chat";
import type { ContextHandler } from "@tokenring-ai/chat";

const chatService = agent.requireServiceByType(ChatService);

// Register custom context handler
chatService.registerContextHandler("custom-context", async function* ({ input, agent }) {
  yield {
    role: "user",
    content: `Custom context for: ${input}`
  };
});

// Use in context configuration
const config = chatService.getChatConfig(agent);
config.context.initial.push({ type: "custom-context" });
```

## Plugin Configuration

The chat package is configured through the plugin system with the following schema:

```typescript
import {z} from "zod";
import {ChatServiceConfigSchema} from "@tokenring-ai/chat";

const packageConfigSchema = z.object({
  chat: ChatServiceConfigSchema,
  tools: z.record(z.string(), ChatToolConfigSchema),
});
```

**Configuration Options:**

```typescript
const config = {
  chat: {
    // Array of default model names to try for auto-selection
    defaultModels: ["auto"],

    // Default configuration for all agents
    agentDefaults: {
      // Default model name (supports "auto", "auto:reasoning", "auto:frontier")
      model: "auto",

      // System instructions for the AI (string or function returning string)
      systemPrompt: "You are a helpful assistant",

      // Maximum processing steps before prompting for continuation
      maxSteps: 30,

      // Compaction settings
      compaction: {
        policy: "ask", // "automatic" | "ask" | "never"
        compactionThreshold: 0.5, // Threshold for automatic compaction
        applyThreshold: 0.7, // Threshold for applying pending compaction (defaults to compactionThreshold)
        background: false, // Run compaction in background
        focus: "Default focus text for compaction" // Focus topic for compaction
      },

      // List of enabled tool names (supports wildcards)
      enabledTools: [],

      // List of hidden tool names (supports wildcards) - hidden from model but available
      hiddenTools: [],

      // Context configuration
      context: {
        // Context items for initial messages
        initial: [
          { type: "system-message" },
          { type: "tool-context" },
          { type: "prior-messages" },
          { type: "current-message" }
        ],
        // Context items for follow-up messages
        followUp: [
          { type: "prior-messages" },
          { type: "current-message" }
        ]
      }
    }
  },
  // Define custom agent tools
  tools: {
    "my-tool": {
      agentType: "coder",
      displayName: "My Tool",
      description: "Does something useful",
      inputArguments: {
        param: {
          description: "A parameter",
          defaultValue: "default"
        }
      },
      steps: ["Step 1", "Step 2"],
      subAgent: {}
    }
  }
};
```

### Context Source Types

| Type              | Description                        |
|-------------------|------------------------------------|
| `system-message`  | Adds the system prompt             |
| `prior-messages`  | Adds previous conversation history |
| `current-message` | Adds the current user input        |
| `tool-context`    | Adds context from enabled tools    |

### Compaction Policies

| Policy      | Description                                       |
|-------------|---------------------------------------------------|
| `automatic` | Automatically compact when threshold is reached   |
| `ask`       | Ask user before compacting (in non-headless mode) |
| `never`     | Never compact automatically                       |

### Compaction Thresholds

- **compactionThreshold**: When context reaches this fraction of max tokens, compaction is triggered
- **applyThreshold**: When to apply a staged compaction (defaults to compactionThreshold if not set)

## Tools

The chat package provides utilities for working with tools:

### tokenRingTool

Converts a tool definition to TokenRing format with automatic artifact generation:

```typescript
import {tokenRingTool} from "@tokenring-ai/chat";
import {z} from "zod";

const toolDefinition = tokenRingTool({
  name: "my-tool",
  displayName: "My Tool",
  description: "Does something useful",
  inputSchema: z.object({
    param: z.string()
  }),
  async execute(input, agent) {
    // Tool implementation
    return "result";
  }
});
```

### tool_search

Built-in tool for searching hidden tools by regex pattern. Automatically enabled when `hiddenTools` is configured.

**Usage:** The AI can use this tool to search for and enable hidden tools by providing a regex pattern.

**Examples:**

```json
{
  "name": "tool_search",
  "arguments": {
    "regex": "weather|forecast"
  }
}
```

**Features:**

- Searches tool names and descriptions
- Case-insensitive regex matching
- Automatically enables matching tools
- Only searches hidden tools

### Tool Result Types

Tool execution can return different result types:

**Text Results:**

```typescript
// String result
return "Success!";

// Text object
return { type: "text", text: "Success!" };

// With artifact
return { type: "text", text: "Success!", artifact: { name: "Result", ... } };
```

**Media Results:**

```typescript
return {
  type: "media",
  mediaType: "image/png",
  data: "base64-encoded-data"
};
```

**JSON Results:**

```typescript
return {
  type: "json",
  data: { key: "value", number: 42 }
};
```

**Artifact Generation:**

- Tool calls automatically generate artifacts showing request JSON and response
- Media tools generate base64-encoded artifacts
- Errors are caught and reported with clear error messages

### createAgentTool

Creates a tool that runs a sub-agent with configured steps:

```typescript
import {createAgentTool} from "@tokenring-ai/chat/util/createAgentTool";

const toolDefinition = createAgentTool("my-tool", {
  agentType: "coder",
  displayName: "My Tool",
  description: "Does something useful",
  inputArguments: {
    param: {
      description: "A parameter",
      defaultValue: "default"
    }
  },
  steps: ["Step 1", "Step 2"],
  subAgent: {}
});
```

## Services

### ChatService Registration

The ChatService is automatically registered when using the plugin, or can be added manually:

```typescript
import ChatService from "@tokenring-ai/chat";
import { TokenRingApp } from "@tokenring-ai/app";

const app = new TokenRingApp();

// Add chat service with default model
app.addServices(new ChatService({
  defaultModels: ["auto"],
  agentDefaults: {
    model: "auto",
    maxSteps: 30,
    compaction: {
      policy: "ask",
      compactionThreshold: 0.5
    },
    enabledTools: [],
    hiddenTools: [],
    context: {
      initial: [
        { type: "system-message" },
        { type: "tool-context" },
        { type: "prior-messages" },
        { type: "current-message" }
      ],
      followUp: [
        { type: "prior-messages" },
        { type: "current-message" }
      ]
    }
  }
}));

await app.start();
```

## Providers

The chat package uses the `ChatModelRegistry` from `@tokenring-ai/ai-client` for model selection and client management. This registry provides:

- Model availability tracking (online, cold, offline)
- Model cost information
- Context length specifications
- Automatic client selection and management

The registry is automatically registered as a service when the `@tokenring-ai/ai-client` package is installed.

## RPC Endpoints

The chat package provides RPC endpoints for remote chat management:

| Endpoint            | Type     | Request                                | Response                                             |
|---------------------|----------|----------------------------------------|------------------------------------------------------|
| `getAvailableTools` | Query    | `{}`                                   | `{ tools: { [toolName]: { displayName: string } } }` |
| `getModel`          | Query    | `{ agentId: string }`                  | `{ status: "success", model: string \| null }`       |
| `setModel`          | Mutation | `{ agentId: string, model: string }`   | `{ status: "success", success: boolean }`            |
| `getEnabledTools`   | Query    | `{ agentId: string }`                  | `{ status: "success", tools: string[] }`             |
| `setEnabledTools`   | Mutation | `{ agentId: string, tools: string[] }` | `{ status: "success", tools: string[] }`             |
| `enableTools`       | Mutation | `{ agentId: string, tools: string[] }` | `{ status: "success", tools: string[] }`             |
| `disableTools`      | Mutation | `{ agentId: string, tools: string[] }` | `{ status: "success", tools: string[] }`             |
| `getChatMessages`   | Query    | `{ agentId: string }`                  | `{ status: "success", messages: StoredChatMessage[] }` |
| `clearChatMessages` | Mutation | `{ agentId: string }`                  | `{ status: "success", success: boolean }`            |

All endpoints return `AgentNotFoundSchema` on error when the agent is not found.

## State Management

The chat service maintains state including:

- **Chat message history**: Full request/response pairs with timestamps
- **Current configuration**: Model, tools, and context settings
- **Enabled tools**: List of active tools
- **Hidden tools**: List of hidden tools (available but not visible to model)
- **Tool execution queue**: Sequential tool execution with async queue
- **Parallel tools mode**: Optional parallel tool execution
- **Injected messages**: Array of messages injected for special purposes
- **Initial configuration**: For reset operations
- **Pending compaction**: Staged compaction waiting to be applied
- **Compaction in progress flag**: Indicates if compaction is currently running

State is automatically managed and preserved across sessions through the ChatServiceState class.

### State Structure

```typescript
{
  currentConfig: {
    model: string,
    systemPrompt: string \| Function,
    maxSteps: number,
    compaction: {
      policy: "automatic" \| "ask" \| "never",
      compactionThreshold: number,
      applyThreshold: number,
      background: boolean,
      focus: string
    },
    enabledTools: string[],
    hiddenTools: string[],
    context: {
      initial: ContextItem[],
      followUp: ContextItem[]
    }
  },
  messages: StoredChatMessage[],
  parallelTools: boolean,
  toolQueue: async.queue,
  injectedMessages: string[],
  pendingCompaction: StoredChatCompaction \| null,
  compactionInProgress: boolean
}
```

## Hooks

The package provides lifecycle hooks for extending chat functionality:

### AfterChatCompletion

Executed after a chat completion is received:

```typescript
import {AfterChatCompletion} from "@tokenring-ai/chat";

// Hook is automatically executed via AgentLifecycleService
// Access response data in hook handlers
class MyHookHandler {
  async executeHook(hook: AfterChatCompletion, agent: Agent) {
    if (hook instanceof AfterChatCompletion) {
      // Process chat completion
      console.log("Chat completed with", hook.response);
    }
  }
}
```

### AfterChatClear

Executed after chat messages are cleared.

### AfterChatCompaction

Executed after context compaction is completed.

### injectSubagentResults

A hook that injects sub-agent results into the chat context.

## Usage Examples

### Basic Chat Setup

```typescript
import { TokenRingApp } from "@tokenring-ai/app";
import ChatService from "@tokenring-ai/chat";

const app = new TokenRingApp();

// Add chat service with default model
app.addServices(new ChatService({
  defaultModels: ["auto"],
  agentDefaults: {
    model: "auto",
    maxSteps: 30,
    compaction: {
      policy: "ask",
      compactionThreshold: 0.5
    },
    enabledTools: [],
    hiddenTools: [],
    context: {
      initial: [
        { type: "system-message" },
        { type: "tool-context" },
        { type: "prior-messages" },
        { type: "current-message" }
      ],
      followUp: [
        { type: "prior-messages" },
        { type: "current-message" }
      ]
    }
  }
}));

// Start the application
await app.start();
```

### Running a Chat Message Programmatically

```typescript
import runChat from "@tokenring-ai/chat/runChat";
import ChatService from "@tokenring-ai/chat";

const chatService = agent.requireServiceByType(ChatService);
const chatConfig = chatService.getChatConfig(agent);

const response = await runChat({
  input: "Hello, how are you?",
  chatConfig,
  agent
});
```

### Managing Tools

```typescript
import ChatService from "@tokenring-ai/chat";

const chatService = agent.requireServiceByType(ChatService);

// Enable specific tools
chatService.enableTools(["web-search", "calculator"], agent);

// Get available tools
const availableTools = chatService.getAvailableToolNames();

// Set exact tool list
chatService.setEnabledTools(["web-search", "calculator"], agent);

// Use wildcard patterns
chatService.ensureToolNamesLike("web-*"); // Expands to all web-* tools

// Disable tools
chatService.disableTools(["calculator"], agent);

// Hide tools (keep available but not visible to model)
chatService.hideTools(["advanced-calculator"], agent);

// Get hidden tools
const hiddenTools = chatService.getHiddenTools(agent);
```

### Managing Chat History

```typescript
import ChatService from "@tokenring-ai/chat";

const chatService = agent.requireServiceByType(ChatService);

// Get all messages
const allMessages = chatService.getChatMessages(agent);

// Get the last message
const lastMessage = chatService.getLastMessage(agent);

// Clear all messages
await chatService.clearChatMessages(agent);

// Undo last message
chatService.popMessage(agent);

// Add new message
chatService.pushChatMessage({
  request: { messages: [] },
  response: { content: [] },
  createdAt: Date.now(),
  updatedAt: Date.now()
}, agent);
```

### Context Management

```typescript
import ChatService from "@tokenring-ai/chat";

const chatService = agent.requireServiceByType(ChatService);

// Build chat messages from context
const messages = await chatService.buildChatMessages({
  input: "Hello",
  chatConfig: chatService.getChatConfig(agent),
  agent
});
```

### Manual Context Compaction

```typescript
import ChatService from "@tokenring-ai/chat";

const chatService = agent.requireServiceByType(ChatService);
const chatConfig = chatService.getChatConfig(agent);

// Compact all prior messages
await chatService.compactContext(chatConfig.compaction, agent);

// Compact with focus topic
await chatService.compactContext({
  ...chatConfig.compaction,
  focus: "important details and main task objectives"
}, agent);
```

### Staging Compaction for Later Application

```typescript
import ChatService from "@tokenring-ai/chat";

const chatService = agent.requireServiceByType(ChatService);
const chatConfig = chatService.getChatConfig(agent);

// Stage compaction for later application
const staged = await chatService.stageContextCompaction(chatConfig.compaction, agent);

// Later, apply the staged compaction
const applied = chatService.applyPendingCompaction(agent);
```

### Tool Analytics Output

```typescript
import {getChatAnalytics} from "@tokenring-ai/chat";

// Get chat analytics
const analytics = getChatAnalytics(response);
console.log(analytics);
```

### Parallel Tool Execution

```typescript
import ChatService from "@tokenring-ai/chat";
import {ChatServiceState} from "@tokenring-ai/chat";

const chatService = agent.requireServiceByType(ChatService);
const state = agent.getState(ChatServiceState);

// Enable parallel tool execution
state.parallelTools = true;

// Tools will now execute in parallel instead of sequentially
```

### Using Hidden Tools with Search

```typescript
import ChatService from "@tokenring-ai/chat";

const chatService = agent.requireServiceByType(ChatService);

// Configure hidden tools
chatService.hideTools(["advanced-search", "database-query"], agent);

// The tool_search tool is automatically enabled when hiddenTools is configured
// The AI can search for tools using regex patterns
// Example: tool_search with regex "database.*query" will find and enable "database-query"
```

### Attachment Support

```typescript
// The /chat send command supports attachments
// Attachments can be text, images, or files
// Text attachments are included as text content
// Image attachments are included as image parts
// File attachments are included as file parts

// Configure context handler to allow/deny remote attachments
const config = chatService.getChatConfig(agent);
config.context.initial = [
  {
    type: "current-message",
    allowRemoteAttachments: false // Deny remote attachments
  }
];
```

### Dynamic System Prompt

```typescript
import ChatService from "@tokenring-ai/chat";

const chatService = agent.requireServiceByType(ChatService);

// Use a function for dynamic system prompts
chatService.updateChatConfig({
  systemPrompt: () => `You are helping with task: ${currentTask}`
}, agent);
```

### Registering Custom Tools

```typescript
import ChatService from "@tokenring-ai/chat";
import { z } from "zod";

const chatService = agent.requireServiceByType(ChatService);

// Register tools from a package
chatService.addTools({
  name: "my-tool",
  displayName: "My Tool",
  description: "Does something useful",
  inputSchema: z.object({
    param: z.string()
  }),
  async execute(input, agent) {
    return `Processed: ${input.param}`;
  }
});
```

## Best Practices

### Model Selection

- Use `auto` for automatic model selection based on availability
- Use `auto:reasoning` for complex reasoning tasks
- Use `auto:frontier` for cutting-edge capabilities
- Set specific models for reproducible results

### Tool Usage

- Use wildcard patterns for enabling multiple tools (`web-*`)
- Enable only necessary tools to reduce context overhead
- Use `/tools select` for interactive tool selection
- Use hidden tools for large tool sets to save context tokens
- Use `tool_search` to search for hidden tools by pattern

### Context Optimization

- Enable automatic compaction for long conversations
- Use manual compaction before starting new topics
- Monitor token usage with analytics output
- Use staged compaction for non-blocking compaction
- Configure appropriate thresholds for your use case

### Error Handling

- Always check for `CommandFailedError` in command execution
- Handle model unavailability with retry logic
- Validate tool inputs before execution

### Tool Development

- Always include artifacts for better debugging
- Handle errors gracefully in tool execution
- Use descriptive tool names and descriptions
- Include proper input schema validation
- Use `requiredContextHandlers` to specify context needs

### Hidden Tools

- Use hidden tools when you have many tools available
- Hidden tools save context tokens while remaining accessible
- The `tool_search` tool enables dynamic tool activation
- Configure appropriate search patterns for your tools

## Testing and Development

### Testing

```bash
bun test
bun test --coverage
```

### Package Structure

```text
pkg/chat/
├── index.ts                    # Main exports
├── ChatService.ts              # Core chat service class
├── runChat.ts                  # Core chat execution function
├── schema.ts                   # Type definitions and Zod schemas
├── plugin.ts                   # Plugin registration
├── commands.ts                 # Command exports
├── contextHandlers.ts          # Context handler exports
├── hooks.ts                    # Lifecycle hook definitions
├── tools.ts                    # Tool exports
├── lifecycle.ts                # Lifecycle hook classes
├── contextHandlers/
│   ├── currentMessage.ts       # Current message handler with attachment support
│   ├── priorMessages.ts        # Prior messages handler with truncation
│   ├── systemMessage.ts        # System message handler
│   └── toolContext.ts          # Tool context handler
├── commands/
│   ├── chat/
│   │   ├── send.ts             # Send message implementation
│   │   ├── context.ts          # Context display
│   │   ├── compact.ts          # Context compaction
│   │   └── reset.ts            # Reset chat
│   ├── model/
│   │   ├── get.ts              # Get model implementation
│   │   ├── set.ts              # Set model implementation
│   │   ├── select.ts           # Interactive selection
│   │   ├── reset.ts            # Reset to default
│   │   └── settings/
│   │       ├── show.ts         # Show model settings
│   │       ├── set.ts          # Set model settings
│   │       ├── select.ts       # Select model settings
│   │       ├── enable.ts       # Enable model settings
│   │       └── disable.ts      # Disable model settings
│   ├── tool/
│   │   ├── list.ts             # List tools
│   │   ├── enable.ts           # Enable tools
│   │   ├── disable.ts          # Disable tools
│   │   ├── select.ts           # Select tools interactively
│   │   ├── set.ts              # Set tools
│   │   └── hide.ts             # Hide tools
├── util/
│   ├── createAgentTool.ts      # Agent tool creation utility
│   ├── tokenRingTool.ts        # Tool wrapper utility
│   └── getChatAnalytics.ts     # Analytics output
├── state/
│   └── chatServiceState.ts     # State management class
├── rpc/
│   ├── chat.ts                 # RPC endpoints
│   └── schema.ts               # RPC schema definitions
├── tools/
│   └── toolSearch.ts           # Tool search utility
└── vitest.config.ts            # Test configuration
```

## Dependencies

### Production Dependencies

- `@tokenring-ai/app` (0.2.0) - Application framework
- `@tokenring-ai/ai-client` (0.2.0) - AI model registry and client management
- `@tokenring-ai/agent` (0.2.0) - Agent system
- `@tokenring-ai/utility` (0.2.0) - Utility functions
- `@tokenring-ai/lifecycle` (0.2.0) - Lifecycle management
- `@tokenring-ai/rpc` (0.2.0) - RPC endpoints
- `zod` (^4.3.6) - Schema validation
- `async` (^3.2.6) - Async utilities

### Development Dependencies

- `typescript` (^6.0.2) - TypeScript compiler
- `vitest` (^4.1.1) - Testing framework

## License

MIT License - see LICENSE file for details.
