import { describe, expect, it } from "bun:test";
import type { ParsedChatConfig, StoredChatMessage } from "../schema.ts";
import { ChatServiceState } from "./chatServiceState.ts";

const turn = (createdAt: number) => ({ instructions: "", messages: [], response: {}, createdAt, updatedAt: createdAt }) as unknown as StoredChatMessage;

describe("ChatServiceState.serializeAt", () => {
  it("keeps only the turns finished by the branch point and drops a later compaction", () => {
    const state = new ChatServiceState({} as ParsedChatConfig);
    state.messages = [turn(100), turn(200), turn(300)];
    state.pendingCompaction = { startIndex: 0, endIndex: 1, messages: [], createdAt: 300 };

    const branched = state.serializeAt(250);

    expect(branched.messages.map(message => message.createdAt)).toEqual([100, 200]);
    expect(branched.pendingCompaction).toBeNull();
    // The live state is untouched.
    expect(state.messages).toHaveLength(3);
  });

  it("returns the current state when nothing happened after the branch point", () => {
    const state = new ChatServiceState({} as ParsedChatConfig);
    state.messages = [turn(100)];
    state.pendingCompaction = { startIndex: 0, endIndex: 1, messages: [], createdAt: 100 };

    expect(state.serializeAt(500)).toEqual(state.serialize());
  });
});
