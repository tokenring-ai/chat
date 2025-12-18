import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import createSubcommandRouter from "@tokenring-ai/agent/util/subcommandRouter";
import feature from "./chat/feature.ts";
import send from "./chat/send.ts";
import settings from "./chat/settings.ts";
import context from "./chat/context.ts";

const description =
  "/chat - Send messages and manage chat AI settings";


const execute = createSubcommandRouter({
  settings,
  feature,
  context,
  send,
});

const help: string = `# /chat - Send messages and manage chat AI settings

## /chat send <message>

Send a message to the AI chat service. This is the primary command for communicating with the AI, using your selected model and current context.

### Examples

/chat send Hello, how are you?          # Send a simple message

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
} satisfies TokenRingAgentCommand;