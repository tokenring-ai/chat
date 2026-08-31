import { BeforeInputReceived } from "@tokenring-ai/agent";
import type Agent from "@tokenring-ai/agent/Agent";
import type { HookSubscription } from "@tokenring-ai/lifecycle/types";
import { HookCallback } from "@tokenring-ai/lifecycle/util/hooks";
import ContextualSearchService from "../ContextualSearchService.ts";

const name = "resolveContextualTags";
const displayName = "Chat/Resolve contextual @ tags";
const description = "Resolves @[provider:id] tags in incoming chat messages via registered contextual search providers";

async function resolveContextualTags(data: BeforeInputReceived, agent: Agent) {
  if (data.input.message.startsWith("/") && !data.input.message.match(/^\s*\/chat\s*send/)) return;

  const service = agent.getService(ContextualSearchService);
  if (!service) return;
  await service.resolveTags(data.input, agent);
}

const callbacks = [new HookCallback(BeforeInputReceived, resolveContextualTags)];

export default {
  name,
  displayName,
  description,
  callbacks,
} satisfies HookSubscription;
