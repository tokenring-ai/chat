import type Agent from "@tokenring-ai/agent/Agent";
import type { InputMessage } from "@tokenring-ai/agent/AgentEvents";
import type { MaybePromise } from "bun";

export type ContextualSearchItem = {
  id: string;
  tag: string;
  title: string;
  subtitle?: string;
  categoryId: string;
  categoryLabel: string;
  score?: number;
};

export type ContextualSearchCategory = {
  id: string;
  label: string;
  items: ContextualSearchItem[];
};

export type ContextualSearchQuery = {
  query: string;
  limit: number;
  agent: Agent;
  signal?: AbortSignal;
};

export type ContextualSearchPendingProvider = {
  id: string;
  categoryId: string;
  categoryLabel: string;
};

export type ContextualSearchSnapshot = {
  categories: ContextualSearchCategory[];
  pending: ContextualSearchPendingProvider[];
};

export interface ContextualSearchProvider {
  readonly id: string;
  readonly categoryId: string;
  readonly categoryLabel: string;
  isAvailable?(agent: Agent): boolean;
  search(query: ContextualSearchQuery): MaybePromise<ContextualSearchItem[]> | AsyncIterable<ContextualSearchItem[]>;
  resolve?(tag: { itemId: string }, input: InputMessage, agent: Agent): MaybePromise<void>;
}
