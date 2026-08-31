import { describe, expect, it } from "bun:test";
import type Agent from "@tokenring-ai/agent/Agent";
import type TokenRingApp from "@tokenring-ai/app";
import AgentContextualSearchProvider from "./AgentContextualSearchProvider.ts";

function fakeAgent(overrides: { id: string; displayName: string; agentType?: string; description?: string; idle?: boolean }): Agent {
  return {
    id: overrides.id,
    displayName: overrides.displayName,
    config: {
      agentType: overrides.agentType ?? "worker",
      description: overrides.description ?? "",
    },
    getState: () => ({ idle: overrides.idle ?? true }),
  } as unknown as Agent;
}

describe("AgentContextualSearchProvider", () => {
  it("excludes the requesting agent and matches name, type, and id", () => {
    const self = fakeAgent({ id: "self-id", displayName: "Me" });
    const reviewer = fakeAgent({ id: "rev-1", displayName: "Reviewer", agentType: "review", idle: true });
    const writer = fakeAgent({ id: "wri-1", displayName: "Writer", idle: false });
    const app = {
      requireService: () => ({
        getAgents: () => [self, reviewer, writer],
      }),
    } as unknown as TokenRingApp;

    const provider = new AgentContextualSearchProvider(app);
    const all = provider.search({ query: "", limit: 8, agent: self });
    expect(all.map(item => item.id)).toEqual(["rev-1", "wri-1"]);
    expect(all[0]?.tag).toBe("@[agent:rev-1]");

    const filtered = provider.search({ query: "rev", limit: 8, agent: self });
    expect(filtered.map(item => item.id)).toEqual(["rev-1"]);
  });
});
