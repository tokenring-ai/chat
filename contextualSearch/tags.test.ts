import { describe, expect, it } from "bun:test";
import { findActiveMention, formatContextualTag, parseContextualTags, replaceActiveMention } from "./tags.ts";

describe("formatContextualTag / parseContextualTags", () => {
  it("round-trips provider id and item id, including colons in the item id", () => {
    const tag = formatContextualTag("file", "posix:src/index.ts");
    expect(tag).toBe("@[file:posix:src/index.ts]");
    expect(parseContextualTags(`See ${tag} please`)).toEqual([
      {
        providerId: "file",
        itemId: "posix:src/index.ts",
        start: 4,
        end: 4 + tag.length,
        raw: tag,
      },
    ]);
  });

  it("encodes ] in item ids", () => {
    const tag = formatContextualTag("file", "posix:a]b");
    expect(tag).toBe("@[file:posix:a%5Db]");
    expect(parseContextualTags(tag)[0]?.itemId).toBe("posix:a]b");
  });

  it("parses multiple tags", () => {
    const text = "Use @[skill:review] with @[agent:abc]";
    expect(parseContextualTags(text).map(tag => `${tag.providerId}:${tag.itemId}`)).toEqual(["skill:review", "agent:abc"]);
  });
});

describe("findActiveMention", () => {
  it("finds a mention at the start of the input", () => {
    expect(findActiveMention("@foo", 4)).toEqual({ query: "foo", start: 0, end: 4 });
  });

  it("finds a mention after whitespace and includes the whole token when the cursor is in the middle", () => {
    expect(findActiveMention("see @foobar", 7)).toEqual({ query: "foobar", start: 4, end: 11 });
  });

  it("returns null for email-like tokens", () => {
    expect(findActiveMention("user@host", 9)).toBeNull();
  });

  it("returns null inside a completed or in-progress @[ tag", () => {
    expect(findActiveMention("@[file:posix:src/a.ts]", 22)).toBeNull();
    expect(findActiveMention("@[file:posix", 12)).toBeNull();
  });

  it("returns null when the cursor is past a completed mention token", () => {
    expect(findActiveMention("@foo bar", 8)).toBeNull();
  });

  it("returns an empty query immediately after @", () => {
    expect(findActiveMention("@", 1)).toEqual({ query: "", start: 0, end: 1 });
  });
});

describe("replaceActiveMention", () => {
  it("replaces the mention and leaves a trailing space", () => {
    expect(replaceActiveMention("see @fo", { query: "fo", start: 4, end: 7 }, "@[skill:review]")).toEqual({
      next: "see @[skill:review] ",
      cursor: 20,
    });
  });
});
