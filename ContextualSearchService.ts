import type Agent from "@tokenring-ai/agent/Agent";
import type { InputMessage } from "@tokenring-ai/agent/AgentEvents";
import type { TokenRingService } from "@tokenring-ai/app/types";
import formatError from "@tokenring-ai/utility/error/formatError";
import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";
import type {
  ContextualSearchCategory,
  ContextualSearchItem,
  ContextualSearchPendingProvider,
  ContextualSearchProvider,
  ContextualSearchQuery,
  ContextualSearchSnapshot,
} from "./ContextualSearchProvider.ts";
import { parseContextualTags } from "./contextualSearch/tags.ts";

export type ContextualSearchOptions = {
  limitPerProvider?: number;
};

type SearchEvent =
  | { type: "batch"; name: string; provider: ContextualSearchProvider; items: ContextualSearchItem[] }
  | { type: "error"; name: string; error: unknown }
  | { type: "done"; name: string };

export default class ContextualSearchService implements TokenRingService {
  readonly name = "ContextualSearchService";
  description = "Searches registered contextual providers for chat @ mentions";

  private providers = new KeyedRegistry<ContextualSearchProvider>();
  registerProvider = this.providers.set;
  unregisterProvider = this.providers.unregister;
  getAvailableProviders = this.providers.keysArray;
  getProvider = this.providers.get;

  async search(query: string, agent: Agent, options: ContextualSearchOptions = {}): Promise<ContextualSearchCategory[]> {
    let categories: ContextualSearchCategory[] = [];
    for await (const snapshot of this.searchStream(query, agent, options)) {
      categories = snapshot.categories;
    }
    return categories;
  }

  async *searchStream(query: string, agent: Agent, options: ContextualSearchOptions = {}, signal?: AbortSignal): AsyncGenerator<ContextualSearchSnapshot> {
    const limitPerProvider = options.limitPerProvider ?? 8;
    const available = this.providers.entriesArray().filter(([, provider]) => provider.isAvailable?.(agent) !== false);
    const pending = new Map<string, ContextualSearchPendingProvider>(
      available.map(([name, provider]) => [name, { id: name, categoryId: provider.categoryId, categoryLabel: provider.categoryLabel }]),
    );
    const categories = new Map<string, ContextualSearchCategory>();
    const events: SearchEvent[] = [];
    let wake: (() => void) | undefined;

    const emit = (event: SearchEvent) => {
      events.push(event);
      wake?.();
    };

    for (const [name, provider] of available) {
      void (async () => {
        try {
          const searchQuery: ContextualSearchQuery = { query, limit: limitPerProvider, agent, ...(signal ? { signal } : {}) };
          for await (const items of iterateProviderSearch(provider, searchQuery)) {
            if (signal?.aborted) return;
            emit({ type: "batch", name, provider, items });
          }
        } catch (error: unknown) {
          emit({ type: "error", name, error });
        } finally {
          emit({ type: "done", name });
        }
      })();
    }

    yield toSnapshot(categories, pending);
    if (available.length === 0 || signal?.aborted) return;

    while (pending.size > 0) {
      if (signal?.aborted) return;
      if (events.length === 0) {
        await new Promise<void>(resolve => {
          wake = resolve;
        });
        wake = undefined;
        continue;
      }

      const event = events.shift();
      if (!event) continue;

      if (event.type === "batch") {
        if (event.items.length === 0) continue;
        mergeCategory(categories, event.provider, event.items);
        yield toSnapshot(categories, pending);
        continue;
      }

      if (event.type === "error") {
        agent.warningMessage(`[ContextualSearchService] Provider ${event.name} failed: ${formatError(event.error, { includeStack: false })}`);
        continue;
      }

      pending.delete(event.name);
      yield toSnapshot(categories, pending);
    }
  }

  async resolveTags(input: InputMessage, agent: Agent): Promise<void> {
    for (const tag of parseContextualTags(input.message)) {
      const provider = this.providers.get(tag.providerId);
      if (!provider?.resolve) continue;
      try {
        await provider.resolve({ itemId: tag.itemId }, input, agent);
      } catch (error: unknown) {
        agent.warningMessage(`[ContextualSearchService] Failed to resolve ${tag.raw}: ${formatError(error, { includeStack: false })}`);
      }
    }
  }
}

function toSnapshot(categories: Map<string, ContextualSearchCategory>, pending: Map<string, ContextualSearchPendingProvider>): ContextualSearchSnapshot {
  return {
    categories: [...categories.values()],
    pending: [...pending.values()],
  };
}

function mergeCategory(categories: Map<string, ContextualSearchCategory>, provider: ContextualSearchProvider, items: ContextualSearchItem[]): void {
  const existing = categories.get(provider.categoryId) ?? {
    id: provider.categoryId,
    label: provider.categoryLabel,
    items: [],
  };
  existing.items.push(...items);
  existing.items.sort(compareSearchItems);
  categories.set(provider.categoryId, existing);
}

function compareSearchItems(left: ContextualSearchItem, right: ContextualSearchItem): number {
  const scoreDiff = (right.score ?? 0) - (left.score ?? 0);
  if (scoreDiff !== 0) return scoreDiff;
  return left.title.localeCompare(right.title, undefined, { numeric: true, sensitivity: "base" });
}

function isAsyncIterable(value: unknown): value is AsyncIterable<ContextualSearchItem[]> {
  return typeof value === "object" && value !== null && Symbol.asyncIterator in value;
}

async function* iterateProviderSearch(provider: ContextualSearchProvider, query: ContextualSearchQuery): AsyncGenerator<ContextualSearchItem[]> {
  const result = provider.search(query);
  if (isAsyncIterable(result)) {
    yield* result;
    return;
  }
  yield await result;
}
