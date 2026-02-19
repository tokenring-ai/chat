import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import createSubcommandRouter from "@tokenring-ai/agent/util/subcommandRouter";
import context from "./chat/context.ts";
import send from "./chat/send.ts";

const description =
  "/chat - Send messages and manage chat AI settings";


const execute = createSubcommandRouter({
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