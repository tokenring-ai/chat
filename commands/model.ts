import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import createSubcommandRouter from "@tokenring-ai/agent/util/subcommandRouter";
import modelDefault from "./model/default.ts";
import settings from "./model/settings.ts";
import get from "./model/get.ts";
import reset from "./model/reset.ts";
import select from "./model/select.ts";
import set from "./model/set.ts";

const description = "/model - Set or show the target model for chat";

const execute = createSubcommandRouter({
  set,
  reset,
  get,
  select,
  settings,
  default: modelDefault
});

const help: string = `# /model <get|set|select|reset>

Set or display the AI model used for chat responses. Choose from available models based on your needs for speed, quality, and cost.

## Usage

/model                    # Show current model and open selector (unless headless)
/model get                # Show current model
/model set <model_name>   # Set to specific model
/model select             # Interactive model selection
/model set gpt-5.2        # Set to specific model
/model reset              # Reset to initial configured model
/model settings           # Manage model feature flags

## Interactive Mode

- Models are grouped by provider (OpenAI, Anthropic, etc.)
- Status indicators show availability:
  - ✅ Online - Ready for immediate use
  - 🧊 Cold - May have startup delay
  - 🔴 Offline - Currently unavailable
- Current model is highlighted

## Special Values

- **auto** - Automatically selects best available model
- **auto:reasoning** - Prefers models with advanced reasoning
- **auto:frontier** - Prefers latest cutting-edge models

## Examples

/model                     # Show current model and open selector
/model get                 # Show current model only
/model select              # Browse and select model interactively
/model set gpt-5.2         # Use GPT-5.2
/model reset               # Reset to initial configured model.

# /model settings <show|set|select|enable|disable>

Manage feature flags on the current model.

## Usage

/model settings                             # Show settings (default)
/model settings show                        # Show enabled and available settings
/model settings set <key[=value]>           # Set a single feature flag
/model settings select                      # Interactive feature selection
/model settings enable <key[=value]> ...    # Enable one or more feature flags
/model settings disable <key> ...           # Disable feature flags

## Examples

/model settings show
/model settings set websearch
/model settings set temperature=0.7
/model settings select
/model settings enable reasoning
/model settings disable reasoning
`;

export default {
  description,
  execute,
  help,
} satisfies TokenRingAgentCommand;