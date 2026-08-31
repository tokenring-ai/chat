import { AgentManager } from "@tokenring-ai/agent";
import type Agent from "@tokenring-ai/agent/Agent";
import { AgentEventState } from "@tokenring-ai/agent/state/agentEventState";
import type TokenRingApp from "@tokenring-ai/app";
import type { ContextualSearchItem, ContextualSearchProvider, ContextualSearchQuery } from "../ContextualSearchProvider.ts";
import { formatContextualTag } from "./tags.ts";

export default class AgentContextualSearchProvider implements ContextualSearchProvider {
  readonly id = "agent";
  readonly categoryId = "agents";
  readonly categoryLabel = "Agents";

  constructor(private readonly app: TokenRingApp) {}

  search({ query, limit, agent }: ContextualSearchQuery): ContextualSearchItem[] {
    const needle = query.trim().toLowerCase();
    const matches: Array<ContextualSearchItem & { idle: boolean }> = [];

    for (const other of this.app.requireService(AgentManager).getAgents()) {
      if (other.id === agent.id) continue;
      if (needle && !agentMatchesQuery(other, needle)) continue;

      const idle = other.getState(AgentEventState).idle;
      matches.push({
        id: other.id,
        tag: formatContextualTag(this.id, other.id),
        title: other.displayName,
        subtitle: `${other.config.agentType} · ${other.id.slice(0, 8)}`,
        categoryId: this.categoryId,
        categoryLabel: this.categoryLabel,
        score: (idle ? 200 : 100) + nameScore(other.displayName, needle),
        idle,
      });
    }

    matches.sort((left, right) => {
      if (left.idle !== right.idle) return left.idle ? -1 : 1;
      return (right.score ?? 0) - (left.score ?? 0) || left.title.localeCompare(right.title);
    });

    return matches.slice(0, limit).map(({ idle: _idle, ...item }) => item);
  }
}

function agentMatchesQuery(agent: Agent, needle: string): boolean {
  return [agent.displayName, agent.config.agentType, agent.id, agent.config.description].some(value => value.toLowerCase().includes(needle));
}

function nameScore(name: string, needle: string): number {
  if (!needle) return 0;
  const lower = name.toLowerCase();
  if (lower.startsWith(needle)) return 50;
  if (lower.includes(needle)) return 20;
  return 0;
}
