# @tokenring-ai/chat

Tool calling AI chat client for the TokenRing ecosystem.

## Overview

The `@tokenring-ai/chat` package provides the chat layer for agents in the TokenRing
framework: it manages the active model and its feature flags, builds request context from
pluggable context handlers, executes tool calls (sequentially or in parallel), compacts long
conversations, tracks usage and cost, and exposes interactive commands for every part of the
chat lifecycle.

Chat state lives per agent in the `ChatServiceState` state slice, so the model, enabled
tools, message history, and resource-limit tallies persist across sessions. The package ships
a plugin (`@tokenring-ai/chat/plugin`) that registers the service, commands, tools, context
handlers, lifecycle hook, and the JSON-RPC endpoint at `/rpc/chat`.

### Key Features

- **Multi-provider model support**: model selection and client management through
  `ChatModelRegistry` and `TranscriptionModelRegistry` from `@tokenring-ai/ai-client`.
- **Per-turn resource limits**: optional `maxSteps`, `maxCost`, `maxInputTokens`,
  `maxOutputTokens`, and `maxRuntime` caps that stop a turn before it overspends.
- **Context management**: built-in context handlers for the current message, prior messages,
  tool context, and tool calls; automatic, staged, and manual compaction.
- **Tool registry**: wildcard enable/disable/set operations, `adjustActivation` hooks, and
  sequential or parallel execution controlled by the `parallelTools` flag.
- **Tool approval safety levels**: tools declare a numeric risk level (1–10); actions at or
  below `autoToolApprovalLevel` run automatically, while higher-risk actions follow an
  ask / reject / auto-classify policy.
- **Built-in tools**: `tools_list`, `enable_tools`, `get_current_datetime`, `give_up`, and
  `sleep`, plus config-defined sub-agent tools.
- **Attachments**: text, image, audio, and video attachments, with audio transcription when
  the selected chat model does not support audio input.
- **Analytics**: input/output token counts, cost breakdown, context length, and throughput
  reported after each turn via `getChatAnalytics`.
- **Lifecycle hooks**: `AfterChatCompletion`, `AfterChatClear`, `AfterChatCompaction`, and
  automatic sub-agent result injection.
- **Editable tools**: `ToolDirectoryService` keeps one YAML file per agent tool in the workspace, so tools can be authored, edited, and installed from a marketplace registry rather than living only in config
- **RPC API**: 20 methods at `/rpc/chat`, including subscription streams for model, enabled
  tools, usage, and tool-approval state.

## Installation

```bash
bun add @tokenring-ai/chat
```

Then register the plugin in your TokenRing application. The plugin is exported from the
`plugin` subpath:

```typescript
import chatPlugin from "@tokenring-ai/chat/plugin";

export default {
  plugins: [chatPlugin],
};
```

## Chat Commands

The package registers nineteen agent commands.

### Chat Management Commands

| Command                                        | Description                                                  |
|------------------------------------------------|--------------------------------------------------------------|
| `/chat send <message>`                         | Send messages to the LLM (supports attachments)              |
| `/chat context`                                | Show the current context for the chat session                |
| `/chat compact [focus]`                        | Compact conversation context by summarizing prior messages   |
| `/chat reset`                                  | Reset the chat context                                       |
| `/approval [--level <0-10>] [--mode <ask\|reject\|auto>]` | Show or set tool approval level and mode (alias: `/approve`) |

### Model Commands

| Command                                   | Description                                                |
|-------------------------------------------|------------------------------------------------------------|
| `/chat model get`                         | Show current model                                         |
| `/chat model set <modelName>`             | Set the model                                              |
| `/chat model select`                      | Interactively select a model (alias: `/model`)             |
| `/chat model reset`                       | Reset to initial model                                     |
| `/chat model settings show`               | Show model settings                                        |
| `/chat model settings set <token>`        | Set a model feature flag (`key` or `key=value`)            |
| `/chat model settings select`             | Interactively select model settings (alias: `/model settings`) |
| `/chat model settings enable <keys>`      | Enable model feature flags                                 |
| `/chat model settings disable <keys>`     | Disable model feature flags                                |

### Tool Commands

| Command                    | Description                                                       |
|----------------------------|-------------------------------------------------------------------|
| `/tools list`              | List enabled tools                                                |
| `/tools enable <toolNames>`| Enable tools                                                      |
| `/tools disable <toolNames>` | Disable tools                                                   |
| `/tools set <toolNames>`   | Set enabled tools (replaces the current selection)                |
| `/tools select`            | Interactively select tools                                       |

### Command Details

- **`/chat send <message>`** sends the message remainder to the LLM through `runChat` and
  reports a token breakdown (`getChatAnalytics`) plus the response. With `allowAttachments`
  the command accepts text, image, audio, and video attachments.
- **`/chat context`** prints the exact system prompt and message list that would be sent to
  the model (`buildChatMessages` with the input `"input"`).
- **`/chat compact [focus]`** runs `compactContext` immediately using the optional `focus`
  remainder, falling back to the configured compaction `focus`.
- **`/chat reset`** clears the message history and any pending compaction for the agent.
- **`/approval`** with no arguments prints the current tool-approval level and mode. With
  `--level <0-10>` and/or `--mode <ask|reject|auto>` it updates the per-agent approval
  policy. Tool commands resolve wildcard patterns (for example `web-*`) against the
  registered tool names; `/tools set` replaces the enabled set, `/tools enable` adds to it,
  and `/tools disable` removes from it.
- **`/chat model settings set`** accepts a `key` or `key=value` token; bare keys are enabled
  as boolean flags and values are coerced with `coerceFeatureValue`. The settings are
  serialized into the model string with `serializeModel`. `/chat model settings enable` takes
  a space-separated `remainder` of tokens; `/chat model settings disable` takes
  space-separated keys to remove.

## Tools

The plugin registers five built-in tools on `ChatService`:

| Tool                   | Display Name               | Description                                                               |
|------------------------|----------------------------|---------------------------------------------------------------------------|
| `tools_list`           | `Chat/List Tools`          | Retrieves a list of currently inactive tools                              |
| `enable_tools`         | `Chat/Enable Tools`        | Enables the specified tools for the agent (with user approval)            |
| `get_current_datetime` | `Agent/Get Current Date & Time` | Returns the current date, time, day of week, and local timezone     |
| `give_up`              | `Agent/Give Up`            | Stops work with an explanation when the task cannot be completed          |
| `sleep`                | `Agent/Sleep`              | Sleeps for a specified number of seconds, then returns date and time      |

### tools_list

**Display Name:** `Chat/List Tools`

**Description:** Retrieves a list of currently inactive tools that can be enabled using the
enable_tool tool with the permission of the user.

**Schema strictness:** the tool accepts an empty input schema (`z.object({})`).

Lists every registered tool that is not currently enabled for the agent. The model sees the
list of inactive tool names with their display names, together with a message stating how
many inactive tools were found.

### enable_tools

**Display Name:** `Chat/Enable Tools`

**Description:** Enables the specified tools for the agent.

| Parameter   | Type       | Description                                                      |
|-------------|------------|------------------------------------------------------------------|
| `toolNames` | `string[]` | The names of the tools to enable, as returned by list_tools      |

Before enabling the tools, the tool asks the user for approval
(`agent.askForApproval`). If the user denies access, the tool returns a failed result with
the message `**Tools** User denied access to tools`. Otherwise it calls
`ChatService.enableTools` and reports the number of tools enabled.

### get_current_datetime

**Display Name:** `Agent/Get Current Date & Time`

**Description:**

```text
Returns the current date, time, day of week, and the user's local timezone.
Use this tool any time you need to determine what date and time it is.
Do not rely on your internal knowledge of what date and time it is, since that date and time
is when you were ***trained***, and is not reflective of the current date and time
```

**Schema strictness:** the tool accepts an empty input schema (`z.object({})`).

Returns the current date, time, day of week, and the user's local timezone as reported by the
agent's runtime.

### give_up

**Display Name:** `Agent/Give Up`

**Description:** Call this tool when you are unable to complete the assigned task, or when
the task violates your guidelines, or when you have encountered an unrecoverable
error.Provide a clear explanation of why the work cannot be finished.

| Parameter | Type     | Description                                                       |
|-----------|----------|-------------------------------------------------------------------|
| `reason`  | `string` | A detailed explanation of why the task cannot be completed.       |

Calls `agent.abortCurrentOperation` with the reason, which stops the current chat turn. The
model is told to stop what it is doing and wait for input.

### sleep

**Display Name:** `Agent/Sleep`

**Description:** Sleeps for a specified number of seconds, then returns the current date and
time. Useful for introducing delays in agent workflows or waiting before performing actions.

| Parameter | Type     | Description                                                                   |
|-----------|----------|-------------------------------------------------------------------------------|
| `seconds` | `number` | The number of seconds to sleep (must be a positive integer, max 1 hour).       |

The input is validated with `z.number().int().positive().max(3600)` — a positive integer with a
maximum of 1 hour.

### Config-Defined Tools

The plugin config's `tools` key defines additional agent tools at runtime. Each entry creates
a tool that runs a **sub-agent** of a configured `agentType`. Tools defined this way are not
exported from `tools.ts`; they are created by `createAgentTool` and reconciled against the
live tool registry by `ChatService.reconfigureTools` (see
[Configuration](#configuration)).

See the `tools` table under [Configuration](#configuration) for the accepted fields. Each
`inputArguments` entry becomes a string input argument on the tool; `steps` may reference
input argument names with `{{ name }}` placeholders, which are interpolated from the tool
arguments at execution time.

## Context Handlers

Context handlers build the messages that are sent to the model. The plugin registers four
built-in handlers, keyed by the `type` used in the `context` config:

| Handler            | Description                                                                             |
|--------------------|-----------------------------------------------------------------------------------------|
| `current-message`  | Yields injected messages, then the current user input with attachments                  |
| `prior-messages`   | Yields previous conversation messages with middle-of-stream truncation                  |
| `tool-context`     | Yields the required context of every enabled tool (`requiredContextHandlers`)           |
| `tool-call`        | Executes a native TokenRing tool and injects its result into the conversation           |

### current-message

Yields each string in `ChatServiceState.injectedMessages` as a user message, then builds the
current user input with attachments via `buildUserMessageWithAttachments`. Text attachments
are inlined, image/audio/video attachments are encoded as file parts, and remote attachments
(`href` encoding) are only fetched when `allowRemoteAttachments` is enabled in the chat
config.

### prior-messages

With `maxMessages: z.number().min(5).default(1000)`, concatenates the last stored message's
request and response messages and, when the stream is longer than `maxMessages`, removes the
middle portion while keeping the first and last two messages intact. A short user message
(`... this content was removed to shorten the chat context ...`) marks the removed span.

### tool-context

Collects the `requiredContextHandlers` of every enabled tool and yields the output of each
handler in registration order. When a required handler is not registered, the handler lookup
throws.

### tool-call

Accepts `{ header: string, toolName: string, toolInput: Record<string, any> }`, resolves the
named native TokenRing tool, parses `toolInput` against its input schema, executes it, and
yields the result (with any attachments) as a user message prefixed by `header`. Executing a
non-native tool throws `Tool "…" is not a native TokenRing tool, and cannot be injected into
the chat context.`

Register custom handlers with `ChatService.registerContextHandler(name, handler)`; they are
referenced from `context.initial` / `context.followUp` by `type`:

```typescript
import ChatService from "@tokenring-ai/chat";
import type { ContextHandler } from "@tokenring-ai/chat";

const chatService = agent.requireService(ChatService);

chatService.registerContextHandler("custom-context", function* ({ input }) {
  yield {
    role: "user",
    content: `Custom context for: ${input}`,
  };
});
```

## Configuration

The plugin config schema is:

```typescript
import { z } from "zod";
import { ChatServiceConfigSchema } from "@tokenring-ai/chat";
import { ChatToolConfigSchema } from "@tokenring-ai/chat/schema";

const packageConfigSchema = z.object({
  chat: ChatServiceConfigSchema,
  tools: z.record(z.string(), ChatToolConfigSchema).default({}),
  toolDirectory: z.string().default("tools"),
});
```

```yaml
chat:
  defaultModels:
    - auto
  defaultTranscriptionModels: []
  agentDefaults:
    model: auto
    enabledTools: []
    parallelTools: false
    maxSteps: 0
    allowRemoteAttachments: true
    autoToolApprovalLevel: 6
    toolApprovalMode: auto
    compaction:
      policy: ask
      compactionThreshold: 0.5
      background: false
    context:
      initial:
        - type: tool-context
        - type: prior-messages
        - type: current-message
      followUp:
        - type: prior-messages
        - type: current-message

toolDirectory: tools
tools:
  my-tool:
    agentType: coder
    displayName: My Tool
    description: Does something useful
    inputArguments:
      param:
        description: A parameter
        defaultValue: default
    steps:
      - Write a file describing {{ param }}
    subAgent: {}
```

### `chat` fields

| Field                    | Type     | Required | Default | Description                                                                  |
|--------------------------|----------|----------|---------|------------------------------------------------------------------------------|
| `chat.defaultModels`     | `string[]` | no     | `[]`    | Model fallback chain used when no model is specified                         |
| `chat.defaultTranscriptionModels` | `string[]` | no | `[]` | Transcription model fallback chain                                    |
| `chat.agentDefaults`     | object   | no       | `{}`    | Defaults applied to every newly created agent                               |

### `chat.agentDefaults` fields

| Field                      | Type                 | Required | Default   | Description                                                                                  |
|----------------------------|----------------------|----------|-----------|----------------------------------------------------------------------------------------------|
| `model`                    | `string`             | no       | —         | Model new agents use by default                                                              |
| `transcriptionModel`       | `string`             | no       | —         | Model used to transcribe audio attachments                                                   |
| `enabledTools`             | `string[]`           | no       | `[]`      | Tools enabled by default for new agents                                                      |
| `parallelTools`            | `boolean`            | no       | `false`   | Allow tools to be executed in parallel                                                       |
| `maxSteps`                 | `number`             | no       | `0`       | Maximum tool-call steps per turn (0 = unlimited)                                             |
| `maxCost`                  | `number`             | no       | —         | Maximum estimated cost in USD per turn; chat stops when this is reached                      |
| `maxInputTokens`           | `number`             | no       | —         | Maximum cumulative input tokens per turn; chat stops when this is reached                    |
| `maxOutputTokens`          | `number`             | no       | —         | Maximum cumulative output tokens per turn; chat stops when this is reached                   |
| `maxRuntime`               | `number`             | no       | —         | Maximum runtime in seconds per turn; chat stops when this is reached                         |
| `allowRemoteAttachments`   | `boolean`            | no       | `true`    | Allow agents to fetch attachments from remote URLs                                           |
| `autoToolApprovalLevel`    | `number` (`int`, 0–10) | no     | `6`       | Auto-approve tool actions at or below this safety level (0–10). Higher levels use `toolApprovalMode` |
| `toolApprovalMode`         | `"ask" \| "reject" \| "auto"` | no | `"auto"`  | How to handle tool actions above `autoToolApprovalLevel`: ask, reject, or auto               |
| `saveClassificationLogsToFile` | `string`          | no       | —         | File path to save tool approval classification logs to                                       |
| `compaction`               | object               | no       | `{}`      | Long conversation history compaction behavior                                                |
| `context`                  | object               | no       | `{}`      | Context items included in outgoing messages                                                  |

### `chat.agentDefaults.compaction` fields

| Field                  | Type                            | Required | Default             | Description                                                         |
|------------------------|---------------------------------|----------|---------------------|---------------------------------------------------------------------|
| `policy`               | `"automatic" \| "ask" \| "never"` | no     | `"ask"`             | When to compact long conversation history                           |
| `compactionThreshold`  | `number`                        | no       | `0.5`               | Context usage fraction that triggers compaction                     |
| `applyThreshold`       | `number`                        | no       | `compactionThreshold` | Context usage fraction at which compaction is applied             |
| `background`           | `boolean`                       | no       | `false`             | Run compaction in the background instead of blocking the turn       |
| `focus`                | `string`                        | no       | (see below)         | Focus/topic instructions given to the model producing the summary   |

The default `focus` is:

```text
- Important Details
- Resources, files, or URLs that were referenced
- A clear description of the current task
- A summary of the previous steps taken
- Key details about the current task
- Any other relevant information that might be useful for the current task
```

### `chat.agentDefaults.context` fields

| Field      | Type             | Required | Default                                                          | Description                                                  |
|------------|------------------|----------|------------------------------------------------------------------|--------------------------------------------------------------|
| `initial`  | `ContextSource[]`| no       | `tool-context`, `prior-messages`, `current-message`              | Context sources included in the first message of a turn      |
| `followUp` | `ContextSource[]`| no       | `prior-messages`, `current-message`                              | Context sources included in follow-up messages               |

### Per-agent overrides

`agentDefaults` apply to every agent, but a per-agent `chat` block can override any of them.
Per-agent values are validated with `ChatAgentConfigSchema` and support `systemPrompt`
(required, with `{{ WORKSPACE_DIRECTORY }}`, `{{ WORKING_DIRECTORY }}`, and `{{ DATE }}`
interpolation when the first message of a turn is built). `{{ WORKSPACE_DIRECTORY }}` and
`{{ WORKING_DIRECTORY }}` resolve from the app configuration at message-build time — they are
not chat package config fields. For example:

```yaml
agents:
  leader:
    chat:
      model: auto
      systemPrompt: "You are the team lead, working in {{ WORKSPACE_DIRECTORY }}."
      enabledTools:
        - tools_*
```

### `tools` fields (`ChatToolConfigSchema`)

| Field            | Type                                          | Required | Description                                |
|------------------|-----------------------------------------------|----------|--------------------------------------------|
| `agentType`      | `string`                                      | yes      | Type of agent used to execute the tool     |
| `displayName`    | `string`                                      | yes      | Tool Display Name                          |
| `description`    | `string`                                      | yes      | Tool Description                           |
| `category`       | `string`                                      | no (`User-Created Tools`) | Group this tool appears under in pickers and the marketplace |
| `inputArguments` | `Record<string, { description, defaultValue? }>` | yes    | Tool Input Schema (each argument is a string input) |
| `steps`          | `string[]`                                    | yes (min 1) | The steps to execute                                              |
| `subAgent`       | `SubAgentConfigSchema`                        | no       | The subagent configuration                 |

`inputArguments` values carry `description` (required) and `defaultValue` (optional string).
`steps` are executed by a fresh sub-agent of `agentType`; `{{ name }}` placeholders in a step
are replaced by the corresponding input argument. `subAgent` exposes the `SubAgentConfigSchema`
defaults: `forwardChatOutput: false`, `forwardStatusMessages: true`, `forwardSystemOutput:
false`, `forwardHumanRequests: true`, `forwardReasoning: false`, `forwardInputCommands:
true`, `timeout: 0`, `maxResponseLength: 10000`, `minContextLength: 1000`.

### Tool approval levels

Config-defined and built-in tools request approval through `ChatService.checkToolApproval`
with a numeric `safetyLevel`. The classification scale is fixed (verbatim from
`ToolApprovalClassificationLevels`):

| Level | Description                                                          |
|-------|----------------------------------------------------------------------|
| 1     | Completely harmless (read-only, no side effects)                     |
| 2     | Minimal risk (local read/list, no writes)                            |
| 3     | Low risk (writes temporary or ephemeral data only)                   |
| 4     | Low-moderate risk (creates non-critical files or network reads)      |
| 5     | Moderate risk (modifies existing non-critical data or installs packages) |
| 6     | Might delete non-temporary files or data                             |
| 7     | Elevated risk (bulk modifications, privilege changes, external writes) |
| 8     | Could lead to the destruction of data                                |
| 9     | Severe risk (system configuration damage, security exposure)         |
| 10    | Absolutely destructive system command                                |

When the reported level is at or below `autoToolApprovalLevel` the action is approved
immediately. Above that level, `toolApprovalMode` decides: `ask` prompts the user,
`reject` denies without prompting, and `auto` re-assesses the risk with the chat model
(`ToolApprovalSafetyAssessmentSchema`) and then auto-approves or prompts. When
`saveClassificationLogsToFile` is set, every approval decision is appended as one JSON line
per decision.

### Schema Metadata

The schema annotates fields with `.meta()` for config UI integration:

| Field                        | `.meta()` annotation                                                                      |
|------------------------------|-------------------------------------------------------------------------------------------|
| `chat`                       | `{ label: "Chat", description: "Conversation and tool-use behavior for agents" }`         |
| `chat.defaultModels`         | `{ description: "Model fallback chain used when no model is specified" }`                 |
| `chat.defaultTranscriptionModels` | `{ advanced: true, description: "Transcription model fallback chain" }`               |
| `chat.agentDefaults`         | `{ label: "Agent Defaults" }`                                                             |
| `agentDefaults.model`        | `{ description: "Model new agents use by default" }`                                      |
| `agentDefaults.transcriptionModel` | `{ advanced: true, description: "Model used to transcribe audio attachments" }`     |
| `agentDefaults.enabledTools` | `{ description: "Tools enabled by default for new agents" }`                              |
| `agentDefaults.parallelTools`| `{ advanced: true, description: "Allow tools to be executed in parallel" }`               |
| `agentDefaults.maxSteps`     | `{ advanced: true, description: "Maximum tool-call steps per turn (0 = unlimited)" }`      |
| `agentDefaults.maxCost`      | `{ advanced: true, description: "Maximum estimated cost in USD per turn; chat stops when this is reached" }` |
| `agentDefaults.maxInputTokens` | `{ advanced: true, description: "Maximum cumulative input tokens per turn; chat stops when this is reached" }` |
| `agentDefaults.maxOutputTokens` | `{ advanced: true, description: "Maximum cumulative output tokens per turn; chat stops when this is reached" }` |
| `agentDefaults.maxRuntime`   | `{ advanced: true, description: "Maximum runtime in seconds per turn; chat stops when this is reached" }` |
| `agentDefaults.allowRemoteAttachments` | `{ advanced: true, description: "Allow agents to fetch attachments from remote URLs" }` |
| `agentDefaults.autoToolApprovalLevel` | `{ advanced: true, description: "Auto-approve tool actions at or below this safety level (0–10). Higher levels use toolApprovalMode." }` |
| `agentDefaults.toolApprovalMode` | `{ advanced: true, description: "How to handle tool actions above autoToolApprovalLevel: ask, reject, or auto" }` |
| `agentDefaults.saveClassificationLogsToFile` | `{ advanced: true, description: "File path to save tool approval classification logs to" }` |
| `agentDefaults.compaction`   | `{ label: "Compaction", advanced: true, description: "Long conversation history compaction behavior" }` |
| `compaction.policy`          | `{ description: "When to compact long conversation history" }`                             |
| `compaction.compactionThreshold` | `{ advanced: true, description: "Context usage fraction that triggers compaction" }`  |
| `compaction.applyThreshold`  | `{ advanced: true, description: "Context usage fraction at which compaction is applied" }` |
| `compaction.background`      | `{ advanced: true, description: "Run compaction in the background instead of blocking the turn" }` |
| `agentDefaults.context`      | `{ label: "Context", advanced: true, description: "Context items included in outgoing messages" }` |

## Core Components

### ToolDirectoryService

Service name `ToolDirectoryService`. Description: *"Manages editable agent tools, backed by YAML files on disk."*

Keeps one YAML file per agent tool at `<toolDirectory>/<toolName>.yaml` — the same arrangement
`AgentDirectoryService` gives agent types, and the reason a tool can be installed from a marketplace
registry at all: a config-only tool has nowhere to land. The file body is a `ToolItemSchema` (a
`ChatToolConfigSchema` plus an optional `installedFrom` provenance block, parsed loosely so unknown keys
survive the round trip); the tool name comes from the file name.

| Method | Description |
|---|---|
| `getToolDirectory()` | The resolved tool directory path |
| `listToolDefinitions()` | Every valid tool file, sorted by name. Unparseable files are logged and skipped so one bad file cannot hide the rest |
| `getToolDefinition(name)` | One tool's body plus its name and mtime, or `null` |
| `createToolDefinition(name, tool)` | Write a new tool file; throws when one already exists |
| `updateToolDefinition(name, tool)` | Overwrite an existing tool file; throws when it does not exist |
| `deleteToolDefinition(name)` | Remove the file; returns `false` when it was not there |
| `syncToService()` | Re-read the directory and replace the workspace tools in `ChatService` |

Names must match `/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/`, checked before any path is built. Every mutation
re-syncs, so a created or deleted tool is live immediately. Where a config tool and a workspace tool
share a name, the workspace one wins — it is the copy the user can actually edit.

### ChatService

The main service class for managing AI chat functionality. It implements `TokenRingService`
and is registered on the app by the plugin, or manually:

```typescript
import ChatService from "@tokenring-ai/chat";
import TokenRingApp from "@tokenring-ai/app";

const app = new TokenRingApp();
const chatService = new ChatService(app, {
  defaultModels: ["auto"],
  agentDefaults: {
    model: "auto",
    maxSteps: 0,
    autoToolApprovalLevel: 6,
    toolApprovalMode: "auto",
    compaction: { policy: "ask", compactionThreshold: 0.5 },
    context: {
      initial: [{ type: "tool-context" }, { type: "prior-messages" }, { type: "current-message" }],
      followUp: [{ type: "prior-messages" }, { type: "current-message" }],
    },
  },
});
app.addService(chatService);
```

The constructor takes `(app: TokenRingApp, options?: ParsedChatServiceConfig)`.

#### Service properties

| Property                 | Type                              | Description                                        |
|--------------------------|-----------------------------------|----------------------------------------------------|
| `name`                   | `"ChatService"`                   | Service name identifier                            |
| `description`            | `"A service for managing AI configuration"` | Service description                     |
| `app`                    | `TokenRingApp`                    | Application instance reference (readonly)          |
| `defaultModel`           | `string \| null`                  | Model selected during `start()` from `defaultModels` |
| `defaultTranscriptionModel` | `string \| null`               | Transcription model selected during `start()`     |

#### Lifecycle and configuration methods

| Method                                                          | Description                                                          |
|-----------------------------------------------------------------|----------------------------------------------------------------------|
| `start()`                                                       | Resolve `defaultModel` / `defaultTranscriptionModel` from the model registries and report to the app |
| `attach(agent, creationContext)`                                | Merge `agentDefaults` with the agent's `chat` config slice, initialize `ChatServiceState`, enable initial tools, and record the model in the creation context |
| `reconfigure(options: ParsedChatServiceConfig)`                 | Replace the service options                                          |
| `reconfigureTools(toolDefinitions: Record<string, ChatToolConfig>)` | Replace the config-defined agent tools and reconcile against the live tool registry |
| `setWorkspaceToolConfigs(toolDefinitions: Record<string, ChatToolConfig>)` | Replace the tools read from the tool directory and reconcile; called by `ToolDirectoryService` |

#### Model management

| Method                                         | Description                                                      |
|------------------------------------------------|------------------------------------------------------------------|
| `setModel(model: string, agent: Agent): void`  | Set the model for the agent                                      |
| `getModel(agent: Agent): string \| null`       | Current model name or the `defaultModel`, or `null`              |
| `requireModel(agent: Agent): string`           | Current model; throws `ConfigurationError("No model selected")` when none is set |
| `getModelAndSettings(agent: Agent)`            | `{ currentModel, base, settings }` from `parseModelAndSettings`  |
| `setTranscriptionModel(model, agent): void`    | Set the transcription model for the agent                        |
| `getTranscriptionModel(agent: Agent): string \| null` | Current transcription model or the default                 |
| `requireTranscriptionModel(agent: Agent): string` | Current transcription model; throws `CommandFailedError` when none is set |

#### Attachment handling

| Method                                                                      | Description                                                                 |
|-----------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| `resolveAttachmentsForModel({ attachments, modelSpec, allowRemoteAttachments?, agent })` | Transcode attachments the chat model cannot consume (currently audio -> text) |
| `transcodeAudioAttachment(attachment, agent, allowRemoteAttachments)`       | Transcribe an audio attachment with the agent's transcription model          |

#### Configuration access

| Method                                                        | Description                                        |
|---------------------------------------------------------------|----------------------------------------------------|
| `getChatConfig(agent: Agent): ParsedChatConfig`               | The agent's merged chat config (`ChatServiceState.currentConfig`) |
| `updateChatConfig(aiConfig: Partial<ParsedChatConfig>, agent: Agent): void` | Merge a partial config into the agent's current config |

#### Tool approval

| Method                                                                                | Description                                                                                                                    |
|---------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| `checkToolApproval(options: CheckToolApprovalOptions, agent: Agent): Promise<boolean \| null>` | Evaluate a tool action against the approval policy; returns `true` (approved), `false` (rejected), or `null` when the user dismissed the prompt |

`CheckToolApprovalOptions` is `{ message, detailedDescription, safetyLevel, toolName?, label?, default? }`.

#### Tool registry

| Method                                                             | Description                                            |
|--------------------------------------------------------------------|--------------------------------------------------------|
| `addTool(tool)`                                                     | Register a single tool; throws `ConfigurationError` on duplicates |
| `addTools(tools: TokenRingToolDefinition[])`                        | Register multiple tools; throws `ConfigurationError` on duplicates |
| `requireTool(toolName: string): NamedTool`                         | Look up a registered tool                              |
| `registerTool(name, tool)` / `unregisterTool(name)`                | Registry-level set / delete accessors                  |
| `getAvailableToolNames(): string[]`                                | All registered tool names                              |
| `getAvailableToolEntries()`                                        | All registered tools as `[name, NamedTool]` entries    |
| `getToolNamesLike(pattern): string[]`                              | Tool names matching a glob pattern                     |
| `ensureToolNamesLike(pattern): string[]`                           | Expand a glob pattern to tool names (throws on no match) |
| `getEnabledTools(agent: Agent): string[]`                          | Tools enabled for the agent                            |
| `setEnabledTools(toolNames, agent): Readonly<string[]>`            | Replace the enabled set (wildcards expanded)           |
| `enableTools(toolNames, agent): Readonly<string[]>`                | Add tools to the enabled set (wildcards expanded)      |
| `disableTools(toolNames, agent): Readonly<string[]>`               | Remove tools from the enabled set (wildcards expanded) |

#### Context handler registry

| Method                                                          | Description                                      |
|-----------------------------------------------------------------|--------------------------------------------------|
| `getContextHandlerByName(name): ContextHandler \| undefined`    | Look up a context handler                         |
| `requireContextHandlerByName(name): ContextHandler`             | Look up a context handler or throw                |
| `registerContextHandler(name, handler): void`                   | Register a single context handler                 |
| `registerContextHandlers(handlers: Record<string, ContextHandler>): void` | Register multiple context handlers       |

#### Message building and history

| Method                                                                  | Description                                                          |
|-------------------------------------------------------------------------|----------------------------------------------------------------------|
| `buildChatMessages(options: BuildChatMessagesOptions)`                  | Build the request messages and system instructions for a turn; returns `{ messages: ContextItem[], instructions: string }` |
| `getChatMessages(agent: Agent): StoredChatMessage[]`                    | All stored chat messages for the agent                               |
| `getLastMessage(agent: Agent): StoredChatMessage \| null`               | The most recent stored message, or `null`                            |
| `pushChatMessage(message: StoredChatMessage, agent: Agent): void`       | Append a message to the history                                      |
| `clearChatMessages(agent: Agent): Promise<void>`                        | Clear messages and pending compaction; fires `AfterChatClear`        |
| `popMessage(agent: Agent): void`                                        | Remove the most recent message (undo)                                |

`BuildChatMessagesOptions` is `{ input: string, attachments?: ChatAttachment[], chatConfig: ParsedChatConfig, agent: Agent }`.

#### Compaction

| Method                                                                      | Description                                                             |
|-----------------------------------------------------------------------------|-------------------------------------------------------------------------|
| `getPendingCompaction(agent: Agent): StoredChatCompaction \| null`          | The staged compaction (if any)                                          |
| `hasPendingCompaction(agent: Agent): boolean`                               | Whether a staged compaction exists                                      |
| `isCompactionInProgress(agent: Agent): boolean`                             | Whether a compaction is currently being prepared                        |
| `applyPendingCompaction(agent: Agent): boolean`                             | Fold the staged compaction into the last message; `false` when there is nothing to apply or the recorded span no longer matches |
| `stageContextCompaction(compactionConfig, agent: Agent): Promise<boolean>`  | Prepare a compaction summary and store it for later; `false` when one is already staged/in progress or there is no prior message |
| `compactContext(compactionConfig, agent: Agent): Promise<void>`             | Compress the prior conversation immediately (used by `/chat compact`)   |

### ChatServiceState

The per-agent state slice (`AgentStateSlice<typeof serializationSchema>`) that stores the chat
config, message history, and turn usage. It is initialized by `ChatService.attach`.

#### State properties

| Property              | Type                                             | Description                                            |
|-----------------------|--------------------------------------------------|--------------------------------------------------------|
| `currentConfig`       | `ParsedChatConfig`                               | The agent's merged chat config                         |
| `initialConfig`       | `ParsedChatConfig`                               | The config at attach time (used by `/chat model reset`) |
| `messages`            | `StoredChatMessage[]`                            | Stored chat history                                    |
| `injectedMessages`    | `string[]`                                       | Messages injected into the next turn (sub-agent results) |
| `pendingCompaction`   | `StoredChatCompaction \| null`                   | Staged compaction                                      |
| `compactionInProgress`| `boolean`                                        | Whether compaction preparation is running              |
| `contextLength`       | `number`                                         | Token count of the last step                           |
| `lastStepUsage`       | `LanguageModelUsage`                             | Usage of the most recent step                          |
| `totalUsage`          | `LanguageModelUsage`                             | Cumulative usage for the current turn                  |
| `totalCosts`          | `AIResponseCost`                                 | Cumulative cost for the current turn                   |
| `toolQueue`           | `async.queue`                                    | Serial queue used for sequential tool execution        |

#### State methods

| Method                                                                   | Description                                                             |
|--------------------------------------------------------------------------|-------------------------------------------------------------------------|
| `runToolMaybeInParallel<T>(executeToolFunction: () => Promise<T>)`        | Execute a tool call; runs in parallel when `parallelTools`, otherwise through the serial `toolQueue` |
| `addCosts(costs: AIResponseCost)`                                        | Accumulate cost into `totalCosts`                                       |
| `addUsage(usage: LanguageModelUsage)`                                    | Update `lastStepUsage` and accumulate `totalUsage`                      |
| `show(): string`                                                         | Markdown summary of the state (messages, tools, approval, compaction, limits) |
| `serialize()` / `deserialize(data)`                                      | Persist / restore the slice                                             |

### runChat

Core chat execution function that runs one turn of the chat lifecycle. It is re-exported from
the package root:

```typescript
import runChat from "@tokenring-ai/chat";

const response = await runChat({
  input: "Hello, how are you?",
  chatConfig: chatService.getChatConfig(agent),
  agent,
});
```

`RunChatOptions` is `{ input: string, attachments?: ChatAttachment[], chatConfig: ParsedChatConfig, agent: Agent }`,
and the function returns `Promise<AIResponse>`.

**What `runChat` does:**

- Resolves an AI client for the agent's model with retry/backoff (recording retries and
  `modelClientUnavailable` errors on `MetricsService`).
- Applies each tool's `adjustActivation` hook, enabling/disabling tools mid-turn and persisting
  the changes back to `ChatServiceState`.
- Resolves attachments for the model (`resolveAttachmentsForModel`), then builds the request
  with `buildChatMessages`.
- Streams the chat with a `stopWhen` callback that enforces the compaction thresholds plus the
  optional `maxSteps` (asking the user when headless is off and the limit is exceeded),
  `maxCost`, `maxInputTokens`, `maxOutputTokens`, and `maxRuntime` limits.
- Pushes the completed exchange onto the message history and fires `AfterChatCompletion`.
- Applies a pending compaction when the `applyThreshold` is reached, and stages a new
  compaction when the `compactionThreshold` is reached (in the background when
  `background: true`).
- When compaction was applied mid-turn and budget remains, recursively continues with a
  `"Continue"` input and reduced remaining limits.

## Services

### Service registration

The plugin registers `ChatService` and `ToolDirectoryService` on the app and waits for the supporting
services to be available. `ChatService` can also be registered manually with `app.addService(new
ChatService(app, options))` (see [Core Components](#core-components)).

### Plugin Lifecycle

The plugin (`plugin/chat/plugin.ts`) defines `install` and `reconfigure`:

| Field         | Value                                                                                       |
|---------------|---------------------------------------------------------------------------------------------|
| `name`        | `@tokenring-ai/chat` (from package.json)                                                     |
| `displayName` | `AI Chat Client`                                                                            |
| `version`     | package version                                                                             |
| `description` | `Tool calling AI chat client for the TokenRing ecosystem`                                   |
| `configSchema`| `z.object({ chat: ChatServiceConfigSchema, tools: z.record(z.string(), ChatToolConfigSchema).default({}), toolDirectory: z.string().default("tools") })` |

- **`install(app)`** — registers the nineteen agent commands with `AgentCommandService`; adds
  `new ChatService(app)` to the app; registers the built-in context handlers and the five
  built-in tools; once `RpcService` is available, registers the `/rpc/chat` endpoint; and once
  `AgentLifecycleService` is available, adds the `injectSubAgentResults` hook. Finally it awaits
  `toolDirectoryService.syncToService()`, so workspace tools are registered before the first
  reconfigure and an agent whose `enabledTools` names one resolves it on the very first apply.
- **`reconfigure(app, config)`** — calls `chatService.reconfigure(config.chat)`,
  `chatService.reconfigureTools(config.tools)`, and
  `toolDirectoryService.reconfigure(config.toolDirectory)`.

### Lifecycle Hooks

The package defines three hook event classes in `lifecycle.ts`. They are emitted by
`runChat` and `ChatService` and are handled through `AgentLifecycleService`:

| Event                 | Trigger                                                                  | Emitted payload                       |
|-----------------------|--------------------------------------------------------------------------|---------------------------------------|
| `AfterChatCompletion` | Each completed chat turn in `runChat`                                    | `response: AIResponse`                |
| `AfterChatClear`      | `ChatService.clearChatMessages`                                          | —                                     |
| `AfterChatCompaction` | `ChatService.compactContext` after a successful immediate compaction     | —                                     |

```typescript
import { AfterChatCompletion } from "@tokenring-ai/chat/lifecycle";

// Hook handlers receive the hook instance; access the response for AfterChatCompletion.
```

The plugin also registers the `injectSubAgentResults` hook subscription
(`hooks/injectSubAgentResults.ts`):

| Property      | Value                                                                            |
|---------------|----------------------------------------------------------------------------------|
| Name          | `injectSubAgentResults`                                                          |
| Display Name  | `Chat/Inject Subagent Results`                                                   |
| Description   | `Injects the results of subagent into the parent agents chat stream`              |
| Callbacks     | `AfterSubAgentResponse` (inject), `AfterChatCompletion` (clear)                  |

On `AfterSubAgentResponse` it appends a markdown block describing the sub-agent's request and
response to `ChatServiceState.injectedMessages`; on `AfterChatCompletion` it clears
`injectedMessages`.

## RPC Endpoints

The plugin registers a single JSON-RPC endpoint at `/rpc/chat` with twenty methods. Stream
methods are state-slice subscription streams: they yield the current projection immediately
and re-yield whenever the underlying `ChatServiceState` slice changes, skipping unchanged
values.

| Method                | Type     | Description                                                         |
|-----------------------|----------|---------------------------------------------------------------------|
| `getAvailableTools`   | query    | All registered tools with display names and descriptions            |
| `getToolDirectory`    | query    | The resolved path of the editable tool directory                    |
| `listToolDefinitions` | query    | Every valid tool YAML file in the tool directory, sorted by name    |
| `getToolDefinition`   | query    | One tool's full body, or `status: "toolNotFound"`                   |
| `createToolDefinition`| mutation | Write a new tool file; throws if the name is taken                  |
| `updateToolDefinition`| mutation | Overwrite an existing tool file; throws if it does not exist        |
| `deleteToolDefinition`| mutation | Remove a tool file; returns `{ success }`                           |
| `getModel`            | query    | The agent's current model and model spec                            |
| `streamModel`         | stream   | Subscription stream of the model and model spec                     |
| `setModel`            | mutation | Set the agent's model                                               |
| `streamChatUsage`     | stream   | Subscription stream of cost, context length, and usage for a turn   |
| `getEnabledTools`     | query    | The agent's enabled tools                                           |
| `streamEnabledTools`  | stream   | Subscription stream of the enabled tools                            |
| `setEnabledTools`     | mutation | Replace the enabled tool set                                        |
| `enableTools`         | mutation | Add tools to the enabled set                                        |
| `disableTools`        | mutation | Remove tools from the enabled set                                   |
| `getToolApprovalLevels` | query  | The fixed safety classification scale (1–10 with descriptions)      |
| `streamToolApproval`  | stream   | Subscription stream of `autoToolApprovalLevel` and `toolApprovalMode` |
| `setToolApproval`     | mutation | Update the agent's `autoToolApprovalLevel` and/or `toolApprovalMode` |
| `clearChatMessages`   | mutation | Clear the agent's chat history                                       |

### `getAvailableTools`

Query with input `{}`; returns `{ tools: Record<string, { displayName: string }> }`.

### `getModel`

Query with `{ agentId: string }`; returns a discriminated union on `status`:

| Status           | Additional Fields                             | Description                             |
|------------------|----------------------------------------------|-----------------------------------------|
| `success`        | `model: string \| null`, `modelSpec` (serialized chat model spec) | The agent's model and spec |
| `modelNotFound`  | —                                            | No model is configured                  |
| `agentNotFound`  | —                                            | The agent does not exist                |

### `streamModel`

Stream with `{ agentId: string }`; same result union as `getModel` (the streamed `modelSpec`
is the serialized model spec). Yields on state changes.

### `setModel`

Mutation with `{ agentId: string, model: string }`; returns `success: { success: boolean }` or
`agentNotFound`.

### `streamChatUsage`

Stream with `{ agentId: string }`. On success yields
`{ model: string \| null, cost: AIResponseCost, contextLength: number, maxContextLength: number \| null, totalUsage: LanguageModelUsage, toolCount: number }`.

### `getEnabledTools`

Query with `{ agentId: string }`; returns `success: { tools: string[] }` or `agentNotFound`.

### `streamEnabledTools`

Stream with `{ agentId: string }`; yields `{ status: "success", tools: readonly string[] }` on
changes or `{ status: "agentNotFound" }` when the agent does not exist.

### `setEnabledTools`, `enableTools`, `disableTools`

Mutations with `{ agentId: string, tools: string[] }`; each returns
`success: { tools: readonly string[] }` (the resulting enabled set) or `agentNotFound`.

### `getToolApprovalLevels`

Query with input `{}`; returns
`{ levels: Array<{ level: number, description: string }> }` for levels 1–10.

### `streamToolApproval`

Stream with `{ agentId: string }`; yields
`{ status: "success", autoToolApprovalLevel: number, toolApprovalMode: "ask" \| "reject" \| "auto" }`
when either value changes, or `agentNotFound`.

### `setToolApproval`

Mutation with `{ agentId: string, autoToolApprovalLevel?: number, toolApprovalMode?: "ask" \| "reject" \| "auto" }`;
returns the updated `{ status: "success", autoToolApprovalLevel, toolApprovalMode }` or
`agentNotFound`.

### `clearChatMessages`

Mutation with `{ agentId: string }`; returns `success: { success: boolean }` or
`agentNotFound`.

## Package Exports

The package entry (`index.ts`) exports:

```typescript
export { default as ChatService } from "./ChatService.ts";
export type { CheckToolApprovalOptions } from "./ChatService.ts";
export { default as runChat } from "./runChat.ts";

export {
  ChatAgentConfigSchema,
  ChatServiceConfigSchema,
  type ContextHandler,
  type ContextItem,
  type NamedTool,
  type ParsedChatConfig,
  type StoredChatMessage,
  type TokenRingToolDefinition,
  ToolApprovalClassificationLevels,
  type ToolApprovalMode,
  ToolApprovalModeSchema,
  type ToolApprovalSafetyAssessment,
  ToolApprovalSafetyAssessmentSchema,
} from "./schema.ts";

export { ChatServiceState } from "./state/chatServiceState.ts";
export { getChatAnalytics } from "./util/getChatAnalytics.ts";
export { tokenRingTool, ToolCallError } from "./util/tokenRingTool.ts";
```

Because `package.json` maps `"./*": "./*.ts"`, every module is also importable by path, for
example `@tokenring-ai/chat/plugin`, `@tokenring-ai/chat/runChat`,
`@tokenring-ai/chat/util/createAgentTool`, `@tokenring-ai/chat/util/tokenRingTool`, and
`@tokenring-ai/chat/state/chatServiceState`. The plugin is intentionally not re-exported from
`index.ts`; import it from the `plugin` subpath.

## Package Structure

```text
plugin/chat/
├── index.ts                    # Main exports
├── ChatService.ts              # Core chat service class, tool approval, compaction
├── runChat.ts                  # Core chat execution function
├── schema.ts                   # Config schemas and types
├── plugin.ts                   # Plugin definition (install + reconfigure)
├── commands.ts                 # Command registry (19 commands)
├── contextHandlers.ts          # Context handler registry (4 handlers)
├── lifecycle.ts                # Hook event classes
├── tools.ts                    # Built-in tool registry (5 tools)
├── bun.config.ts               # Test runner configuration
├── commands/
│   ├── approve.ts              # /approval command
│   ├── chat/
│   │   ├── send.ts             # /chat send
│   │   ├── context.ts          # /chat context
│   │   ├── compact.ts          # /chat compact
│   │   ├── reset.ts            # /chat reset
│   │   └── model/
│   │       ├── get.ts          # /chat model get
│   │       ├── set.ts          # /chat model set
│   │       ├── select.ts       # /chat model select
│   │       ├── reset.ts        # /chat model reset
│   │       └── settings/
│   │           ├── show.ts     # /chat model settings show
│   │           ├── set.ts      # /chat model settings set
│   │           ├── select.ts   # /chat model settings select
│   │           ├── enable.ts   # /chat model settings enable
│   │           └── disable.ts  # /chat model settings disable
│   └── tool/
│       ├── list.ts             # /tools list
│       ├── enable.ts           # /tools enable
│       ├── disable.ts          # /tools disable
│       ├── select.ts           # /tools select
│       └── set.ts              # /tools set
├── contextHandlers/
│   ├── currentMessage.ts       # current-message handler
│   ├── priorMessages.ts        # prior-messages handler
│   ├── toolCall.ts             # tool-call handler
│   └── toolContext.ts          # tool-context handler
├── hooks/
│   └── injectSubagentResults.ts # Sub-agent result injection hook
├── rpc/
│   ├── chat.ts                 # RPC endpoint implementation
│   └── schema.ts               # RPC schema definition
├── state/
│   └── chatServiceState.ts     # Per-agent chat state slice
├── tools/
│   ├── listTools.ts            # tools_list
│   ├── enableTools.ts          # enable_tools
│   ├── getCurrentDatetime.ts   # get_current_datetime
│   ├── giveUp.ts               # give_up
│   └── sleep.ts                # sleep
├── util/
│   ├── buildUserMessageWithAttachments.ts  # User message assembly from attachments
│   ├── createAgentTool.ts      # Config-defined sub-agent tool builder
│   ├── decodeAttachment.ts     # Attachment base64/text decoding
│   ├── getChatAnalytics.ts     # Token/cost analytics formatter
│   └── tokenRingTool.ts        # TokenRing tool wrapper (metrics, parallel queue, errors)
├── LICENSE
├── package.json
└── README.md
```

## Dependencies

| Package                   | Purpose                                                              |
|---------------------------|----------------------------------------------------------------------|
| `@tokenring-ai/app`       | Application framework, `TokenRingApp`, service/plugin types          |
| `@tokenring-ai/agent`     | Agent framework, commands, sub-agent execution, state slices         |
| `@tokenring-ai/ai-client` | `ChatModelRegistry`, `TranscriptionModelRegistry`, AI clients, model settings |
| `@tokenring-ai/metrics`   | `MetricsService`: tool calls, retries, steps, errors                 |
| `@tokenring-ai/utility`   | Registries, enhanced sets/maps, string interpolation, backoff        |
| `@tokenring-ai/lifecycle` | `AgentLifecycleService`, hook execution                              |
| `@tokenring-ai/rpc`       | JSON-RPC endpoint and schema types                                   |
| `zod`                     | Schema validation                                                    |
| `async`                   | Async queue for sequential tool execution                            |
| `@types/async`            | TypeScript types for `async`                                         |

## Testing

```bash
bun run build         # typecheck (tsc --noEmit)
bun test              # run tests
bun test --watch      # watch mode
bun test --coverage   # with coverage
```

The test runner is configured in `bun.config.ts` (node environment, `**/*.test.ts` include).
The package does not currently ship in-package test files.

## License

MIT License - see [LICENSE](./LICENSE) file for details.
