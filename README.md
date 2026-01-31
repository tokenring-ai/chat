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
- **Parallel Tool Execution**: Optional parallel tool execution mode

## Installation

```bash
bun install @tokenring-ai/chat
```

## Chat Commands

The package provides the following chat commands:

### /chat - Send messages and manage chat AI settings

The `/chat` command is the primary interface for interacting with the AI chat service.

#### /chat send <message>

Send a message to the AI chat service.

```bash
/chat send Hello, how are you?
```

#### /chat settings [key=value ...]

Configure AI model settings and behavior.

**Available Settings:**
- `temperature=0.7` - Controls randomness (0.0-2.0)
- `maxTokens=1000` - Maximum response length
- `topP=0.9` - Nucleus sampling threshold (0.0-1.0)
- `frequencyPenalty=0.0` - Reduce repetition (-2.0 to 2.0)
- `presencePenalty=0.0` - Encourage new topics (-2.0 to 2.0)
- `stopSequences=a,b,c` - Stop at these sequences
- `autoCompact=true` - Enable automatic context compaction

```bash
/chat settings temperature=0.5 maxTokens=2000
/chat settings autoCompact=true
```

#### /chat feature <list|enable|disable> [key[=value] ...]

Manage model feature flags that enable special capabilities.

```bash
/chat feature list                              # List features
/chat feature enable reasoning                  # Enable a feature
/chat feature enable temperature=0.7            # Set feature value
/chat feature disable reasoning                 # Disable a feature
```

#### /chat context

Display all context items that would be included in a chat request.

```bash
/chat context
```

### /model - Set or show the target model for chat

Manage the AI model used for chat responses.

```bash
/model                     # Show current model and open selector
/model get                 # Show current model
/model set gpt-5.2         # Set to specific model
/model select              # Interactive model selection
/model reset               # Reset to initial configured model
```

**Special Values:**
- `auto` - Automatically selects best available model
- `auto:reasoning` - Prefers models with advanced reasoning
- `auto:frontier` - Prefers latest cutting-edge models

### /tools [enable|disable|set] <tool1> <tool2> ...

Manage available tools for your chat session.

```bash
/tools                     # Interactive tool selection
/tools enable web-search   # Enable a tool
/tools disable calculator  # Disable a tool
/tools set web-search calculator  # Set exactly which tools are enabled
```

### /compact [<focus>]

Compress the conversation context by summarizing prior messages.

```bash
/compact
/compact specifics of the task at hand
```

## Plugin Configuration

The chat package can be configured through the plugin system:

```typescript
import {z} from "zod";

const configSchema = z.object({
  chat: z.object({
    defaultModels: z.array(z.string()),
    agentDefaults: z.object({
      model: z.string().default("auto"),
      autoCompact: z.boolean().default(true),
      enabledTools: z.array(z.string()).default([]),
      maxSteps: z.number().default(0),
      context: z.object({
        initial: z.array(z.object({type: z.string()})).default([
          {type: "system-message"},
          {type: "tool-context"},
          {type: "prior-messages"},
          {type: "current-message"}
        ]),
        followUp: z.array(z.object({type: z.string()})).default([
          {type: "prior-messages"},
          {type: "current-message"}
        ]),
      }),
    }),
  }),
});
```

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

The chat package provides a utility to convert tools to TokenRing format:

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

## Services

### ChatService

The main service class for managing AI chat functionality.

```typescript
import ChatService from "@tokenring-ai/chat";

const chatService = new ChatService(app, options);
```

#### Methods

**Model Management**

| Method | Description |
|--------|-------------|
| `setModel(model: string, agent: Agent)` | Set the AI model for the agent |
| `getModel(agent: Agent)` | Get the current model name or null |
| `requireModel(agent: Agent)` | Get the current model or throw an error |

**Configuration Management**

| Method | Description |
|--------|-------------|
| `getChatConfig(agent: Agent)` | Get current chat configuration |
| `updateChatConfig(aiConfig: Partial<ParsedChatConfig>, agent: Agent)` | Update configuration with partial updates |

**Message History Management**

| Method | Description |
|--------|-------------|
| `getChatMessages(agent: Agent)` | Get all chat messages |
| `getLastMessage(agent: Agent)` | Get the last message or null |
| `pushChatMessage(message: StoredChatMessage, agent: Agent)` | Add a message to history |
| `clearChatMessages(agent: Agent)` | Clear all messages |
| `popMessage(agent: Agent)` | Remove the last message (undo) |

**Tool Management**

| Method | Description |
|--------|-------------|
| `addTools(tools: Record<string, TokenRingToolDefinition>)` | Register tools from a package |
| `getAvailableToolNames()` | Get all available tool names |
| `getAvailableTools()` | Get all available tool definitions |
| `getToolNamesLike(pattern: string)` | Get tool names matching a pattern |
| `ensureToolNamesLike(pattern: string)` | Expand wildcard patterns to tool names |
| `getEnabledTools(agent: Agent)` | Get enabled tool names |
| `setEnabledTools(toolNames: string[], agent: Agent)` | Set exact enabled tools |
| `enableTools(toolNames: string[], agent: Agent)` | Enable additional tools |
| `disableTools(toolNames: string[], agent: Agent)` | Disable tools |
| `requireTool(toolName)` | Get a tool by name |

**Context Handler Management**

| Method | Description |
|--------|-------------|
| `getContextHandlerByName(name: string)` | Get a context handler by name |
| `requireContextHandlerByName(name: string)` | Get a context handler or throw |
| `registerContextHandler(name: string, handler: ContextHandler)` | Register a single context handler |
| `registerContextHandlers(handlers: Record<string, ContextHandler>)` | Register multiple context handlers |

**Message Building**

| Method | Description |
|--------|-------------|
| `buildChatMessages(input: string, chatConfig: ParsedChatConfig, agent: Agent)` | Build chat request messages from context handlers |

### Context Handlers

Context handlers build the AI chat request by gathering relevant information:

- `current-message`: Adds the current user input
- `prior-messages`: Includes previous conversation history
- `system-message`: Adds system prompts
- `tool-context`: Includes context from enabled tools

## Providers

The chat package uses the `ChatModelRegistry` provider from `@tokenring-ai/ai-client` for model selection and client management.

## RPC Endpoints

The chat package provides RPC endpoints for remote chat management:

| Endpoint | Type | Request | Response |
|----------|------|---------|----------|
| `getAvailableTools` | Query | `{}` | `{ tools: { [toolName]: { displayName: string } } }` |
| `getModel` | Query | `{ agentId: string }` | `{ model: string \| null }` |
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

State is automatically managed and preserved across sessions.

```typescript
// State structure
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
  messages: StoredChatMessage[]
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
    maxSteps: 0,
    enabledTools: []
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
  autoCompact: true
};

const response = await runChat(
  "Hello, how are you?",
  chatConfig,
  agent
);
```

### Managing Tools

```typescript
import ChatService from "@tokenring-ai/chat/ChatService";

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

### Registering Tools

```typescript
import ChatService from "@tokenring-ai/chat/ChatService";

const chatService = agent.requireServiceByType(ChatService);

chatService.addTools({
  "my-tool": {
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
  }
});
```

### Managing Chat History

```typescript
import ChatService from "@tokenring-ai/chat/ChatService";

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
import ChatService from "@tokenring-ai/chat/ChatService";

const chatService = agent.requireServiceByType(ChatService);

// Build chat messages from context
const messages = await chatService.buildChatMessages(
  "Hello",
  chatService.getChatConfig(agent),
  agent
);
```

## Development

### Testing

```bash
bun run test
bun run test:coverage
```

### Package Structure

```
pkg/chat/
├── index.ts                    # Main exports
├── ChatService.ts              # Core chat service
├── runChat.ts                  # Core chat execution
├── schema.ts                   # Type definitions and schemas
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
│   │   ├── send.ts             # Send message
│   │   ├── settings.ts         # Configure settings
│   │   ├── feature.ts          # Manage features
│   │   └── context.ts          # Show context
│   └── model/
│       ├── set.ts              # Set model
│       ├── get.ts              # Get model
│       ├── select.ts           # Select model interactively
│       ├── reset.ts            # Reset to default
│       └── default.ts          # Show current and select
├── util/
│   ├── tokenRingTool.ts        # Tool wrapper
│   ├── compactContext.ts       # Context compaction
│   └── outputChatAnalytics.ts  # Analytics output
├── state/
│   └── chatServiceState.ts     # State management
└── rpc/
    └── chat.ts                 # RPC endpoints
```

## License

MIT License - see LICENSE file for details.
