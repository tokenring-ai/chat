# @tokenring-ai/chat

AI chat client for the Token Ring ecosystem

## Overview

The Chat package provides a comprehensive chat interface for the Token Ring ecosystem, enabling AI-powered conversations with advanced features like context management, tool integration, and interactive command-line controls. It integrates seamlessly with the Token Ring application framework and supports multiple AI providers.

## Key Features

- **AI Chat Interface**: Seamless integration with multiple AI models and providers
- **Context Management**: Intelligent context handling with automatic compaction and customizable context sources
- **Tool Integration**: Extensible tool system with plugin architecture and wildcard matching
- **Interactive Commands**: Rich command set for chat management and configuration including `/chat`, `/model`, `/tools`, and `/compact`
- **State Preservation**: Persistent chat history and configuration with undo/redo capabilities
- **Multi-Provider Support**: Works with various AI model providers (OpenAI, Anthropic, etc.)
- **Interactive Selection**: Tree-based UI for model and tool selection
- **Feature Management**: Advanced model feature flags and capabilities
- **Context Debugging**: Display and inspect chat context for transparency

## Core Components

### ChatService

The main chat service class that manages:

- AI model configuration and selection
- Chat message history and state
- Tool registration and management
- Context handlers for building chat requests
- Interactive command handling

```typescript
import {ChatService} from "@tokenring-ai/chat";

// Create chat service with default model
const chatService = new ChatService({model: "auto"});

// Register tools
chatService.addTools("pkg-name", {
  toolName: {
    name: "tool-name",
    description: "Tool description",
    inputSchema: z.object({ /* input schema */ }),
    execute: async (input, agent) => { /* tool implementation */ }
  }
});
```

### Context Handlers

Context handlers build the AI chat request by gathering relevant information:

- `system-message`: Adds system prompts
- `prior-messages`: Includes previous conversation history
- `current-message`: Adds the current user input
- `tool-context`: Includes context from enabled tools

### Chat Commands

Interactive commands for chat management:

- `/chat`: Send messages and manage chat settings
- `/model`: Set or show the target AI model with interactive selection
- `/compact`: Compact conversation context by summarizing prior messages
- `/tools`: List, enable, disable, or set enabled tools with tree-based UI

## Installation

```bash
# Install the package
bun add @tokenring-ai/chat

# Or add to package.json dependencies
npm install @tokenring-ai/chat
```

## Usage Examples

### Basic Chat Setup

```typescript
import {TokenRingApp} from "@tokenring-ai/app";
import ChatService from "@tokenring-ai/chat";

const app = new TokenRingApp();

// Add chat service with default model
app.addServices(new ChatService({model: "auto"}));

// Start the application
await app.start();
```

### Sending Messages Programmatically

```typescript
import {runChat} from "@tokenring-ai/chat";

// Build chat configuration
const chatConfig = {
  model: "auto",
  systemPrompt: "You are a helpful assistant",
  temperature: 0.7,
  maxTokens: 1000,
  autoCompact: true
};

// Run a chat message
const [response, aiResponse] = await runChat(
  "Hello, how are you?",
  chatConfig,
  agent
);
```

### Managing Tools

```typescript
import {ChatService} from "@tokenring-ai/chat";

const chatService = agent.requireServiceByType(ChatService);

// Enable specific tools
chatService.enableTools(["web-search", "calculator"], agent);

// Get available tools
const availableTools = chatService.getAvailableToolNames();

// Set exact tool list
chatService.setEnabledTools(["web-search", "calculator"], agent);
```

### Interactive Chat Commands

#### Send a Message

```bash
/chat send Hello, how are you?
```

#### Configure AI Settings

```bash
/chat settings temperature=0.5 maxTokens=2000
```

#### Compact Context

```bash
/compact
```

#### Manage Tools

```bash
/tools  # Interactive tool selection
/tools enable web-search calculator
/tools disable file-system
```

#### Select Model

```bash
/model  # Interactive model selection
/model gpt-4-turbo
/model auto:reasoning
```

#### Context Debugging

```bash
/chat context
```

## Configuration

### Chat Configuration Schema

```typescript
import {ChatConfigSchema} from "@tokenring-ai/chat";

const chatConfig = {
  model: "auto",
  systemPrompt: "You are a helpful assistant",
  temperature: 0.7,
  maxTokens: 1000,
  maxSteps: 30,
  topP: 0.9,
  topK: 40,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
  stopSequences: ["\n\n", "---"],
  autoCompact: true,
  enabledTools: [],
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
};
```

### Available Settings

- `model`: AI model identifier (supports "auto", "auto:reasoning", "auto:frontier", or specific model names)
- `systemPrompt`: System instructions for the AI
- `temperature`: Controls randomness (0.0-2.0)
- `maxTokens`: Maximum response length
- `maxSteps`: Maximum processing steps
- `topP`: Nucleus sampling threshold
- `topK`: Top-K sampling
- `frequencyPenalty`: Reduce repetition
- `presencePenalty`: Encourage new topics
- `stopSequences`: Sequences to stop at
- `autoCompact`: Enable automatic context compaction
- `enabledTools`: List of enabled tool names
- `context`: Configuration for context sources

## Plugin Integration

The chat package integrates with the Token Ring application framework:

```typescript
import chatPlugin from "@tokenring-ai/chat";

// Register the plugin
app.use(chatPlugin);
```

### Service Registration

The plugin automatically registers:

- `ChatService`: Main chat service
- Context handlers for building chat requests
- Interactive chat commands (`/chat`, `/model`, `/tools`, `/compact`)
- Model feature management
- Context debugging tools

## API Reference

### ChatService Methods

- `addTools(pkgName, tools)`: Register tools from a package
- `setModel(model, agent)`: Set the AI model
- `getModel(agent)`: Get the current model
- `getChatConfig(agent)`: Get current chat configuration
- `updateChatConfig(aiConfig, agent)`: Update configuration
- `getChatMessages(agent)`: Get chat message history
- `getLastMessage(agent)`: Get the last message
- `pushChatMessage(message, agent)`: Add a message to history
- `clearChatMessages(agent)`: Clear all messages
- `popMessage(agent)`: Remove the last message (undo)
- `getEnabledTools(agent)`: Get enabled tool names
- `setEnabledTools(toolNames, agent)`: Set enabled tools
- `enableTools(toolNames, agent)`: Enable additional tools
- `disableTools(toolNames, agent)`: Disable tools
- `buildChatMessages(input, chatConfig, agent)`: Build chat request messages
- `getChatPreferences(agent)`: Get chat preferences

### runChat Function

```typescript
import {runChat} from "@tokenring-ai/chat";

async function runChat(
  input: string,
  chatConfig: ChatConfig,
  agent: Agent
): Promise<[string, AIResponse]>
```

## State Management

The chat service maintains state including:

- Chat message history with full request/response pairs
- Current configuration
- Enabled tools
- Context preferences

State is automatically managed and preserved across sessions.

## Development

### Testing

```bash
# Run tests
bun test

# Run tests with coverage
bun test:coverage
```

### Build

```bash
# Build the package
bun run build
```

### Package Structure

```
pkg/chat/
├── index.ts           # Main exports
├── ChatService.ts     # Core chat service
├── types.ts          # Type definitions
├── contextHandlers/  # Context handler implementations
├── commands/        # Chat command implementations
├── util/            # Utility functions
├── state/           # State management
└── plugin.ts        # Plugin registration
```

## Dependencies

- `@tokenring-ai/app`: Application framework
- `@tokenring-ai/ai-client`: AI client integration
- `@tokenring-ai/agent`: Agent system
- `@tokenring-ai/utility`: Shared utilities
- `zod`: Schema validation
- `async`: Asynchronous utilities

## License

MIT License