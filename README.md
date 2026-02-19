# @tokenring-ai/chat

## Overview

AI chat client for the Token Ring ecosystem, providing a comprehensive chat interface for AI-powered conversations with advanced features like context management, tool integration, and interactive command-line controls. This package integrates seamlessly with the Token Ring application framework and supports multiple AI providers.

## Features

- **Multi-Provider Support**: Works with various AI model providers (OpenAI, Anthropic, etc.)
- **Context Management**: Intelligent context handling with automatic compaction and customizable context sources
- **Tool Integration**: Extensible tool system with plugin architecture and wildcard matching
- **Interactive Commands**: Rich command set for chat management including `/chat`, `/model`, `/tools`, and `/compact`
- **State Preservation**: Persistent chat history with message history management and message stack for undo operations
- **Interactive Selection**: Tree-based UI for model and tool selection
- **Feature Management**: Advanced model feature flags and capabilities
- **Context Debugging**: Display and inspect chat context for transparency
- **Type-Safe Configuration**: Zod-based schema validation for all configuration options
- **Comprehensive Error Handling**: Clear error messages for configuration and operation issues
- **RPC Endpoints**: Remote procedure call support for chat management
- **Tool Call Artifacts**: Automatic output of tool call requests and responses as artifacts
- **Parallel/Sequential Tool Execution**: Configurable tool execution mode with queue-based processing
- **Token Usage Analytics**: Detailed breakdown of input/output tokens, costs, and timing

## Installation

```bash
bun install @tokenring-ai/chat
```

## Chat Commands

The package provides the following chat commands:

### /chat - Send messages and manage chat AI settings

The `/chat` command is the primary interface for interacting with the AI chat service.

#### /chat send <message>

Send a message to the AI chat service. This is the primary command for communicating with the AI, using your selected model and current context.

**Examples:**
```
/chat send Hello, how are you?
```

**Features:**
- Uses your selected AI model (see `/model`)
- Includes conversation context and system prompts
- Provides available tools if enabled (see `/tools`)
- Shows detailed token usage analytics after completion

#### /chat context

Display all context items that would be included in a chat request. Useful for debugging and understanding what information the AI has access to.

**Examples:**
```
/chat context
```

**Shows:**
- Total number of context messages
- System prompt configuration
- Previous conversation messages (with preview)

**Note:** Context display shows the exact data sent to the AI model.

### /model - Set or show the target model for chat

Manage the AI model used for chat responses.

**Examples:**
```
/model                     # Show current model and open selector (unless headless)
/model get                 # Show current model
/model set gpt-5.2         # Set to specific model
/model select              # Interactive model selection
/model reset               # Reset to initial configured model
/model settings            # Manage model feature flags
```

**Special Values:**
- `auto` - Automatically selects best available model
- `auto:reasoning` - Prefers models with advanced reasoning
- `auto:frontier` - Prefers latest cutting-edge models

### /tools [list|enable|disable|set|select] [tool1] [tool2] ...

Manage available tools for your chat session.

**Examples:**
```
/tools                    # Show tools and open selector (unless headless)
/tools list               # List enabled tools
/tools enable web-search  # Enable a tool
/tools disable calculator # Disable a tool
/tools set web-search calculator  # Set exactly which tools are enabled
/tools select             # Interactive tool selection
```

### /compact [<focus>]

Compress the conversation context by creating intelligent summaries of prior messages.

**Examples:**
```
/compact                    # Compresses all prior messages
/compact specifics of the task at hand, including the goal and expected outcome
```

**How it works:**
- Analyzes all previous messages in the conversation
- Creates concise summaries while preserving key information
- Maintains conversation flow and important context
- Reduces token count for better performance and cost savings

## Plugin Configuration

The chat package is configured through the plugin system with the following schema:

```typescript
import {z} from "zod";
import {ChatServiceConfigSchema} from "@tokenring-ai/chat";

const configSchema = z.object({
  chat: ChatServiceConfigSchema,
});
```

**Configuration Options:**
- `defaultModels` (string[]): Array of default model names to try for auto-selection
- `agentDefaults` (object): Default configuration for all agents
  - `model` (string): Default model name (supports "auto", "auto:reasoning", "auto:frontier")
  - `systemPrompt` (string|function): System instructions for the AI
  - `maxSteps` (number): Maximum processing steps before prompting for continuation
  - `autoCompact` (boolean): Enable automatic context compaction
  - `enabledTools` (string[]): List of enabled tool names (supports wildcards)
  - `context` (object): Context configuration
    - `initial` (ContextItem[]): Context items for initial messages
    - `followUp` (ContextItem[]): Context items for follow-up messages

### Context Source Types

| Type | Description |
|------|-------------|
| `system-message` | Adds the system prompt |
| `prior-messages` | Adds previous conversation history |
| `current-message` | Adds the current user input |
| `tool-context` | Adds context from enabled tools |

## Agent Configuration

Agents can have their own chat configuration merged with the service defaults:

```typescript
const agentConfig = {
  chat: {
    model: "gpt-4",
    systemPrompt: "You are a helpful assistant",
    maxSteps: 50,
    autoCompact: true,
    enabledTools: ["web-search", "calculator"],
    context: {
      initial: [
        {type: "system-message"},
        {type: "tool-context"},
        {type: "prior-messages"},
        {type: "current-message"}
      ],
      followUp: [
        {type: "prior-messages"},
        {type: "current-message"}
      ]
    }
  }
};
```

## Tools

The chat package provides utilities for working with tools:

### tokenRingTool

Converts a tool definition to TokenRing format:

```typescript
import {tokenRingTool} from "@tokenring-ai/chat";

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

**Tool Result Types:**
- `text`: Simple string result or text object with type and content
- `media`: Media result with type, mediaType, and data (base64 encoded)
- `json`: JSON result with type and data (automatically stringified)

## Services

### ChatService

The main service class for managing AI chat functionality. Implements `TokenRingService` and provides comprehensive chat management capabilities.

```typescript
import ChatService from "@tokenring-ai/chat";

const chatService = new ChatService(app, options);
```

#### Constructor

| Parameter | Type | Description |
|-----------|------|-------------|
| `app` | TokenRingApp | The application instance |
| `options` | z.output<typeof ChatServiceConfigSchema> | Configuration options |

#### Methods

##### Model Management

| Method | Description |
|--------|-------------|
| `setModel(model: string, agent: Agent)` | Set the AI model for the agent |
| `getModel(agent: Agent)` | Get the current model name or null |
| `requireModel(agent: Agent)` | Get the current model or throw an error if not set |

##### Configuration Management

| Method | Description |
|--------|-------------|
| `getChatConfig(agent: Agent)` | Get current chat configuration |
| `updateChatConfig(aiConfig: Partial<ParsedChatConfig>, agent: Agent)` | Update configuration with partial updates |

##### Message History Management

| Method | Description |
|--------|-------------|
| `getChatMessages(agent: Agent)` | Get all chat messages |
| `getLastMessage(agent: Agent)` | Get the last message or null |
| `pushChatMessage(message: StoredChatMessage, agent: Agent)` | Add a message to history |
| `clearChatMessages(agent: Agent)` | Clear all messages |
| `popMessage(agent: Agent)` | Remove the last message (undo) |

##### Tool Management

| Method | Description |
|--------|-------------|
| `addTools(tools: Record<string, TokenRingToolDefinition<any>>)` | Register tools from a package |
| `getAvailableToolNames()` | Get all available tool names |
| `getAvailableTools()` | Get all available tool definitions |
| `getToolNamesLike(pattern: string)` | Get tool names matching a pattern |
| `ensureToolNamesLike(pattern: string)` | Expand wildcard patterns to tool names |
| `getEnabledTools(agent: Agent)` | Get enabled tool names |
| `setEnabledTools(toolNames: string[], agent: Agent)` | Set exact enabled tools |
| `enableTools(toolNames: string[], agent: Agent)` | Enable additional tools |
| `disableTools(toolNames: string[], agent: Agent)` | Disable tools |
| `requireTool(toolName)` | Get a tool by name |

##### Context Handler Management

| Method | Description |
|--------|-------------|
| `getContextHandlerByName(name: string)` | Get a context handler by name |
| `requireContextHandlerByName(name: string)` | Get a context handler or throw an error |
| `registerContextHandler(name: string, handler: ContextHandler)` | Register a single context handler |
| `registerContextHandlers(handlers: Record<string, ContextHandler>)` | Register multiple context handlers |

##### Message Building

| Method | Description |
|--------|-------------|
| `buildChatMessages(input: string, chatConfig: ParsedChatConfig, agent: Agent)` | Build chat request messages from context handlers |

#### Context Handlers

Context handlers build the AI chat request by gathering relevant information:

| Handler | Description |
|---------|-------------|
| `current-message` | Adds the current user input |
| `prior-messages` | Includes previous conversation history with intelligent truncation |
| `system-message` | Adds system prompts (supports dynamic system prompts via functions) |
| `tool-context` | Includes context from enabled tools based on their required context handlers |

### ChatServiceState

The state management class that tracks chat state for each agent:

**State Properties:**
- `currentConfig`: Current chat configuration (model, tools, context settings, etc.)
- `messages`: Array of chat messages with timestamps
- `parallelTools`: Boolean flag for parallel/sequential tool execution mode
- `toolQueue`: Async queue for sequential tool execution
- `initialConfig`: Initial configuration for reset operations

**Methods:**
- `serialize()`: Serialize state for persistence
- `deserialize(data)`: Deserialize state from persistence
- `show()`: Return array of strings for display in agent UI
- `reset(what)`: Reset state based on reset type (settings, chat)

**State Persistence:**
- State is persisted across agent sessions
- Uses Zod schema for type-safe serialization/deserialization
- Registered with agent system via `attach()` method

## Providers

The chat package uses the `ChatModelRegistry` provider from `@tokenring-ai/ai-client` for model selection and client management. This registry provides:

- Model availability tracking (online, cold, offline)
- Model cost information
- Context length specifications
- Automatic client selection and management

## RPC Endpoints

The chat package provides RPC endpoints for remote chat management:

| Endpoint | Type | Request | Response |
|----------|------|---------|----------|
| `getAvailableTools` | Query | `{}` | `{ tools: { [toolName]: { displayName: string } } }` |
| `getModel` | Query | `{ agentId: string }` | `{ model: string | null }` |
| `setModel` | Mutation | `{ agentId: string, model: string }` | `{ success: boolean }` |
| `getEnabledTools` | Query | `{ agentId: string }` | `{ tools: string[] }` |
| `setEnabledTools` | Mutation | `{ agentId: string, tools: string[] }` | `{ tools: string[] }` |
| `enableTools` | Mutation | `{ agentId: string, tools: string[] }` | `{ tools: string[] }` |
| `disableTools` | Mutation | `{ agentId: string, tools: string[] }` | `{ tools: string[] }` |
| `getChatMessages` | Query | `{ agentId: string }` | `{ messages: StoredChatMessage[] }` |
| `clearChatMessages` | Mutation | `{ agentId: string }` | `{ success: boolean }` |

## State Management

The chat service maintains state including:

- **Chat message history**: Full request/response pairs with timestamps
- **Current configuration**: Model, tools, and context settings
- **Enabled tools**: List of active tools
- **Tool execution queue**: Sequential tool execution with async queue
- **Parallel tools mode**: Optional parallel tool execution
- **Message stack**: Stack of messages for undo operations
- **Initial configuration**: For reset operations

State is automatically managed and preserved across sessions through the ChatServiceState class.

### State Structure

```typescript
{
  currentConfig: {
    model: string,
    systemPrompt: string | Function,
    maxSteps: number,
    autoCompact: boolean,
    enabledTools: string[],
    context: {
      initial: ContextItem[],
      followUp: ContextItem[]
    }
  },
  messages: StoredChatMessage[],
  parallelTools: boolean,
  toolQueue: async.queue,
  initialConfig: ParsedChatConfig
}
```

## Usage Examples

### Basic Chat Setup

```typescript
import {TokenRingApp} from "@tokenring-ai/app";
import ChatService from "@tokenring-ai/chat";

const app = new TokenRingApp();

// Add chat service with default model
app.addServices(new ChatService({
  defaultModels: ["auto"],
  agentDefaults: {
    model: "auto",
    autoCompact: true,
    maxSteps: 30,
    enabledTools: [],
    context: {
      initial: [
        {type: "system-message"},
        {type: "tool-context"},
        {type: "prior-messages"},
        {type: "current-message"}
      ],
      followUp: [
        {type: "prior-messages"},
        {type: "current-message"}
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

const chatConfig = {
  model: "auto",
  systemPrompt: "You are a helpful assistant",
  maxSteps: 30,
  autoCompact: true,
  enabledTools: [],
  context: {
    initial: [
      {type: "system-message"},
      {type: "tool-context"},
      {type: "prior-messages"},
      {type: "current-message"}
    ],
    followUp: [
      {type: "prior-messages"},
      {type: "current-message"}
    ]
  }
};

const response = await runChat(
  "Hello, how are you?",
  chatConfig,
  agent
);
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
chatService.clearChatMessages(agent);

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
const messages = await chatService.buildChatMessages(
  "Hello",
  chatService.getChatConfig(agent),
  agent
);
```

### Manual Context Compaction

```typescript
import {compactContext} from "@tokenring-ai/chat";

// Compact all prior messages
await compactContext(null, agent);

// Compact with focus topic
await compactContext("important details and main task objectives", agent);
```

### Tool Analytics Output

```typescript
import {outputChatAnalytics} from "@tokenring-ai/chat";

// Output chat analytics
outputChatAnalytics(response, agent, "Chat Complete");
```

## Development

### Testing

```bash
bun test
bun test --coverage
```

### Package Structure

```
pkg/chat/
├── index.ts                    # Main exports
├── ChatService.ts              # Core chat service class
├── runChat.ts                  # Core chat execution function
├── schema.ts                   # Type definitions and Zod schemas
├── plugin.ts                   # Plugin registration
├── chatCommands.ts             # Command exports
├── contextHandlers.ts          # Context handler exports
├── contextHandlers/
│   ├── currentMessage.ts       # Current message handler
│   ├── priorMessages.ts        # Prior messages handler
│   ├── systemMessage.ts        # System message handler
│   └── toolContext.ts          # Tool context handler
├── commands/
│   ├── chat.ts                 # Chat command with subcommands
│   ├── model.ts                # Model command with subcommands
│   ├── tool.ts                 # Tool management command
│   └── compact.ts              # Context compaction command
│   ├── chat/
│   │   ├── send.ts             # Send message implementation
│   │   ├── settings.ts         # Settings configuration
│   │   ├── feature.ts          # Feature management
│   │   └── context.ts          # Context display
│   └── model/
│       ├── set.ts              # Set model implementation
│       ├── get.ts              # Get model implementation
│       ├── select.ts           # Interactive selection
│       ├── reset.ts            # Reset to default
│       ├── default.ts          # Show current and select
│       └── settings/           # Model settings subcommands
│           ├── show.ts         # Show model settings
│           ├── set.ts          # Set model settings
│           ├── select.ts       # Select model settings
│           ├── enable.ts       # Enable model settings
│           └── disable.ts      # Disable model settings
├── tool/                       # Tool command subcommands
│   ├── default.ts              # Default tool action
│   ├── list.ts                 # List tools
│   ├── enable.ts               # Enable tools
│   ├── disable.ts              # Disable tools
│   ├── select.ts               # Select tools interactively
│   └── set.ts                  # Set tools
├── util/
│   ├── tokenRingTool.ts        # Tool wrapper utility
│   ├── compactContext.ts       # Context compaction
│   └── outputChatAnalytics.ts  # Analytics output
├── state/
│   └── chatServiceState.ts     # State management class
├── rpc/
│   ├── chat.ts                 # RPC endpoints
│   └── schema.ts               # RPC schema definitions
└── vitest.config.ts            # Test configuration
```

## Dependencies

### Production Dependencies

- `@tokenring-ai/app` (0.2.0) - Application framework
- `@tokenring-ai/ai-client` (0.2.0) - AI model registry and client management
- `zod` (^4.3.6) - Schema validation
- `@tokenring-ai/agent` (0.2.0) - Agent system
- `@tokenring-ai/utility` (0.2.0) - Utility functions
- `@tokenring-ai/rpc` (0.2.0) - RPC endpoints
- `async` (^3.2.6) - Async utilities

### Development Dependencies

- `@vitest/coverage-v8` (^4.0.18) - Test coverage
- `typescript` (^5.9.3) - TypeScript compiler
- `vitest` (^4.0.18) - Testing framework

## License

MIT License - see LICENSE file for details.
