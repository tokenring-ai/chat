import { describe, expect, it, mock } from "bun:test";
import type Agent from "@tokenring-ai/agent/Agent";
import type { InputMessage } from "@tokenring-ai/agent/AgentEvents";
import type { ContextualSearchItem, ContextualSearchProvider, ContextualSearchQuery } from "./ContextualSearchProvider.ts";
import ContextualSearchService from "./ContextualSearchService.ts";

function mockAgent(): Agent {
  return {
    warningMessage: mock(),
  } as unknown as Agent;
}

function item(overrides: Partial<ContextualSearchItem> & Pick<ContextualSearchItem, "id" | "title" | "categoryId">): ContextualSearchItem {
  return {
    tag: `@[${overrides.categoryId}:${overrides.id}]`,
    categoryLabel: overrides.categoryId,
    ...overrides,
  };
}

describe("ContextualSearchService.search", () => {
  it("fans out to available providers and groups by category", async () => {
    const service = new ContextualSearchService();
    const agent = mockAgent();
    service.registerProvider("file", {
      id: "file",
      categoryId: "filesystems",
      categoryLabel: "Filesystems",
      search: () => [item({ id: "a.ts", title: "a.ts", categoryId: "filesystems", score: 1 })],
    });
    service.registerProvider("skill", {
      id: "skill",
      categoryId: "skills",
      categoryLabel: "Skills",
      search: () => [item({ id: "review", title: "review", categoryId: "skills", score: 1 })],
    });

    const categories = await service.search("re", agent);
    expect(categories.map(category => category.id)).toEqual(["filesystems", "skills"]);
    expect(categories[0]?.items.map(entry => entry.id)).toEqual(["a.ts"]);
    expect(categories[1]?.items.map(entry => entry.id)).toEqual(["review"]);
  });

  it("streams fast providers before a slow provider finishes", async () => {
    const service = new ContextualSearchService();
    const agent = mockAgent();
    let releaseSlow: (() => void) | undefined;
    const slowGate = new Promise<void>(resolve => {
      releaseSlow = resolve;
    });

    service.registerProvider("slow", {
      id: "file",
      categoryId: "filesystems",
      categoryLabel: "Filesystems",
      search: async () => {
        await slowGate;
        return [item({ id: "drive", title: "drive", categoryId: "filesystems", score: 1 })];
      },
    });
    service.registerProvider("fast", {
      id: "skill",
      categoryId: "skills",
      categoryLabel: "Skills",
      search: () => [item({ id: "review", title: "review", categoryId: "skills", score: 1 })],
    });

    const snapshots: Array<{ ids: string[]; pending: string[] }> = [];
    const iterator = service.searchStream("", agent);
    while (true) {
      const next = await iterator.next();
      if (next.done) throw new Error("stream ended before the fast provider yielded");
      const snapshot = {
        ids: next.value.categories.flatMap(category => category.items.map(entry => entry.id)),
        pending: next.value.pending.map(entry => entry.id),
      };
      snapshots.push(snapshot);
      if (snapshot.ids.includes("review") && snapshot.pending.includes("slow")) break;
    }

    expect(snapshots.some(snapshot => snapshot.ids.includes("review") && snapshot.pending.includes("slow"))).toBe(true);
    expect(snapshots.some(snapshot => snapshot.ids.includes("drive"))).toBe(false);

    releaseSlow?.();
    while (true) {
      const next = await iterator.next();
      if (next.done) break;
      snapshots.push({
        ids: next.value.categories.flatMap(category => category.items.map(entry => entry.id)),
        pending: next.value.pending.map(entry => entry.id),
      });
    }
    expect(snapshots.at(-1)?.pending).toEqual([]);
    expect(snapshots.at(-1)?.ids.sort()).toEqual(["drive", "review"]);
  });

  it("skips unavailable providers and isolates failures", async () => {
    const service = new ContextualSearchService();
    const agent = mockAgent();
    service.registerProvider("down", {
      id: "down",
      categoryId: "filesystems",
      categoryLabel: "Filesystems",
      isAvailable: () => false,
      search: () => {
        throw new Error("should not run");
      },
    });
    service.registerProvider("boom", {
      id: "boom",
      categoryId: "skills",
      categoryLabel: "Skills",
      search: () => {
        throw new Error("provider exploded");
      },
    });
    service.registerProvider("ok", {
      id: "ok",
      categoryId: "agents",
      categoryLabel: "Agents",
      search: () => [item({ id: "other", title: "Other", categoryId: "agents", score: 3 })],
    });

    const categories = await service.search("", agent);
    expect(categories).toEqual([
      {
        id: "agents",
        label: "Agents",
        items: [item({ id: "other", title: "Other", categoryId: "agents", score: 3 })],
      },
    ]);
    expect(agent.warningMessage).toHaveBeenCalled();
  });

  it("sorts items in a category by score then title", async () => {
    const service = new ContextualSearchService();
    service.registerProvider("a", {
      id: "a",
      categoryId: "skills",
      categoryLabel: "Skills",
      search: () => [item({ id: "b", title: "beta", categoryId: "skills", score: 1 }), item({ id: "a", title: "alpha", categoryId: "skills", score: 2 })],
    });

    const categories = await service.search("", mockAgent());
    expect(categories[0]?.items.map(entry => entry.title)).toEqual(["alpha", "beta"]);
  });
});

describe("ContextualSearchService.resolveTags", () => {
  it("calls resolve on matching providers and ignores unknown ids", async () => {
    const service = new ContextualSearchService();
    const resolved: string[] = [];
    const provider: ContextualSearchProvider = {
      id: "skill",
      categoryId: "skills",
      categoryLabel: "Skills",
      search(_query: ContextualSearchQuery) {
        return [];
      },
      async resolve(tag) {
        resolved.push(tag.itemId);
      },
    };
    service.registerProvider("skill", provider);

    const input: InputMessage = { from: "user", message: "run @[skill:review] and @[unknown:x]" };
    await service.resolveTags(input, mockAgent());
    expect(resolved).toEqual(["review"]);
  });
});
