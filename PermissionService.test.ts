import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import TokenRingApp from "@tokenring-ai/app";
import ConfigurationService from "@tokenring-ai/app/config/ConfigurationService";
import PluginManager from "@tokenring-ai/app/PluginManager";
import { TokenRingAppConfigSchema } from "@tokenring-ai/app/schema";
import type { TokenRingPlugin } from "@tokenring-ai/app/types";
import { YAML } from "bun";
import { z } from "zod";
import PermissionService, { MemoryPermissionStore, PermissionError } from "./PermissionService.ts";
import { hasWildcard, permissionIdProblem, permissionPatternMatches, permissionSlug } from "./permissions/permissionIds.ts";
import { ChatServiceConfigSchema } from "./schema.ts";

describe("permission ids", () => {
  it("accepts <domain>.<scope>.<action> ids made of [a-z0-9_-] segments", () => {
    for (const id of ["blog.mysite.publish", "github.owner.repo.pr.create", "x.my_acct-1.post", "a.b"]) {
      expect(permissionIdProblem(id)).toBeNull();
    }
  });

  it("rejects malformed ids", () => {
    for (const id of [
      "",
      "blog",
      "Blog.mysite.publish",
      "blog..publish",
      "blog.my site.publish",
      "blog.mysite.",
      ".blog.x",
      `a.${"b".repeat(200)}`,
      "a.b.c.d.e.f.g.h.i",
    ]) {
      expect(permissionIdProblem(id)).not.toBeNull();
    }
    expect(permissionIdProblem(42)).not.toBeNull();
  });

  it("allows wildcards only where asked, and ** only last", () => {
    expect(permissionIdProblem("blog.*.publish")).toMatch(/hand/);
    expect(permissionIdProblem("blog.*.publish", { allowWildcards: true })).toBeNull();
    expect(permissionIdProblem("x.**", { allowWildcards: true })).toBeNull();
    expect(permissionIdProblem("x.**.post", { allowWildcards: true })).toMatch(/last/);
    expect(hasWildcard("x.**")).toBe(true);
    expect(hasWildcard("x.y")).toBe(false);
  });

  it("matches exact ids, * as one segment and ** as the rest", () => {
    expect(permissionPatternMatches("blog.mysite.publish", "blog.mysite.publish")).toBe(true);
    expect(permissionPatternMatches("blog.mysite.publish", "blog.other.publish")).toBe(false);
    expect(permissionPatternMatches("blog.*.publish", "blog.mysite.publish")).toBe(true);
    expect(permissionPatternMatches("blog.*.publish", "blog.mysite.delete")).toBe(false);
    expect(permissionPatternMatches("blog.*.publish", "blog.a.b.publish")).toBe(false);
    expect(permissionPatternMatches("blog.*", "blog.mysite.publish")).toBe(false);
    expect(permissionPatternMatches("x.**", "x.acct.post")).toBe(true);
    expect(permissionPatternMatches("x.**", "x.acct")).toBe(true);
    expect(permissionPatternMatches("x.**", "x")).toBe(false);
    expect(permissionPatternMatches("x.**", "y.acct.post")).toBe(false);
    expect(permissionPatternMatches("github.*.*.pr.create", "github.me.repo.pr.create")).toBe(true);
  });

  it("slugs user-chosen names: plain segments stay, anything else gets a readable prefix and a hash of the exact name", () => {
    expect(permissionSlug("priya")).toBe("priya");
    expect(permissionSlug("my-brand-co")).toBe("my-brand-co");
    expect(permissionSlug("default")).toBe("default");
    const sha = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);
    expect(permissionSlug("My Site!")).toBe(`my-site-${sha("My Site!")}`);
    expect(permissionSlug("   ")).toBe(`x-${sha("   ")}`);
    expect(permissionSlug("日本語")).toBe(`x-${sha("日本語")}`);
  });

  it("slugs never collide, never fall back to default, and are valid segments (property-style)", () => {
    const names = new Set<string>([
      "default",
      "Default",
      "DEFAULT",
      "日本語",
      "中文",
      "*",
      "**",
      "My Acct",
      "my-acct",
      "my acct",
      "My  Acct",
      "",
      " ",
      ".",
      "..",
      "a.b",
      "a-b",
    ]);
    const long = "a".repeat(45);
    names.add(long);
    names.add(`${long}b`);
    names.add("a".repeat(40));
    names.add("a".repeat(41));
    // Names sharing their first 40 characters.
    for (let i = 0; i < 50; i++) names.add(`${"shared-prefix-".repeat(4)}${i}`);
    // Pseudo-random unicode and ASCII names.
    let seed = 12345;
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
    for (let i = 0; i < 3000; i++) {
      const length = 1 + (next() % 30);
      let name = "";
      for (let j = 0; j < length; j++) name += String.fromCodePoint(next() % 5 === 0 ? 0x4e00 + (next() % 200) : 32 + (next() % 95));
      names.add(name);
    }
    const slugs = new Map<string, string>();
    for (const name of names) {
      const slug = permissionSlug(name);
      expect(/^[a-z0-9_-]+$/.test(slug)).toBe(true);
      expect(slug.length).toBeLessThanOrEqual(40);
      expect(permissionIdProblem(`x.${slug}.post`)).toBeNull();
      expect(slugs.has(slug) ? `${slug} is shared by ${slugs.get(slug)} and ${name}` : "unique").toBe("unique");
      slugs.set(slug, name);
      if (slug === "default") expect(name).toBe("default");
      // Idempotent: a slug is already a plain segment.
      expect(permissionSlug(slug)).toBe(slug);
    }
    expect(slugs.size).toBe(names.size);
  });

  it("leaves every already-valid segment of up to 40 characters unchanged", () => {
    for (const name of ["a", "my-acct", "acct_2", "0", "a".repeat(40), "-", "default"]) expect(permissionSlug(name)).toBe(name);
  });
});

function memoryService(maxGrantLevel?: number) {
  const app = new TokenRingApp(TokenRingAppConfigSchema.parse({ app: { workingDirectory: "/tmp", workspaceDirectory: "/tmp", configDirectories: [] } }));
  const store = new MemoryPermissionStore();
  const service = new PermissionService(app, store);
  if (maxGrantLevel !== undefined) service.reconfigure({ maxGrantLevel });
  return { app, store, service };
}

describe("PermissionService", () => {
  it("grants exact ids, matches them, and lists them with usage", async () => {
    const { service } = memoryService();
    expect(service.matches("blog.mysite.publish")).toBeUndefined();
    const grant = await service.grant({ id: "blog.mysite.publish", summary: "Publish posts on mysite" });
    expect(grant).toMatchObject({ id: "blog.mysite.publish", source: "global", uses: 0, summary: "Publish posts on mysite" });
    expect(service.matches("blog.mysite.publish")?.id).toBe("blog.mysite.publish");
    expect(service.matches("blog.mysite.delete")).toBeUndefined();
    expect(service.list()).toHaveLength(1);
  });

  it("granting the same id twice keeps one grant", async () => {
    const { service, store } = memoryService();
    await service.grant({ id: "x.acct.post" });
    await service.grant({ id: "x.acct.post" });
    expect(store.scopes.global).toHaveLength(1);
  });

  it("rejects wildcards, bad ids and levels above the ceiling when granting", async () => {
    const { service } = memoryService();
    await expect(service.grant({ id: "blog.*.publish" })).rejects.toBeInstanceOf(PermissionError);
    await expect(service.grant({ id: "x.**" })).rejects.toThrow(/hand/);
    await expect(service.grant({ id: "Not Valid" })).rejects.toBeInstanceOf(PermissionError);
    await expect(service.grant({ id: "blog.mysite.publish", level: 9 })).rejects.toThrow(/can't be allowed permanently/);
    await expect(service.grant({ id: "blog.mysite.publish", level: 10 })).rejects.toBeInstanceOf(PermissionError);
    expect((await service.grant({ id: "blog.mysite.publish", level: 8 })).id).toBe("blog.mysite.publish");
  });

  it("the ceiling can be lowered but never raised above 8", async () => {
    const { service } = memoryService(5);
    expect(service.maxGrantLevel).toBe(5);
    await expect(service.grant({ id: "blog.mysite.publish", level: 6 })).rejects.toBeInstanceOf(PermissionError);
    service.reconfigure({ maxGrantLevel: 99 });
    expect(service.maxGrantLevel).toBe(8);
    expect(() => ChatServiceConfigSchema.parse({ permissions: { maxGrantLevel: 9 } })).toThrow();
  });

  it("hand-written wildcard grants match; exact grants win; levels 9-10 never match", () => {
    const { service, store } = memoryService();
    const grantedAt = "2026-11-16T09:12:00Z";
    store.scopes.global.push({ id: "blog.*.publish", grantedAt }, { id: "x.**", grantedAt }, { id: "blog.mysite.publish", grantedAt });
    expect(service.matches("blog.other.publish")?.id).toBe("blog.*.publish");
    expect(service.matches("blog.mysite.publish")?.id).toBe("blog.mysite.publish");
    expect(service.matches("x.acct.post")?.id).toBe("x.**");

    expect(service.findGrantFor("x.acct.post", 8)?.id).toBe("x.**");
    expect(service.findGrantFor("x.acct.post", 9)).toBeUndefined();
    expect(service.findGrantFor("x.acct.post", 10)).toBeUndefined();
  });

  it("a hand-written grant for a level 9+ request is ignored with a warning", () => {
    const { app, service, store } = memoryService();
    const output = mock((..._args: unknown[]) => {});
    app.serviceOutput = output;
    store.scopes.global.push({ id: "database.main.drop", grantedAt: "2026-11-16T09:12:00Z" });
    expect(service.findGrantFor("database.main.drop", 9)).toBeUndefined();
    expect(service.findGrantFor("database.main.drop", 9)).toBeUndefined();
    expect(output).toHaveBeenCalledTimes(1);
    expect(String(output.mock.calls[0]?.[1])).toMatch(/above the grantable maximum/);
  });

  it("ignores malformed hand-written ids", () => {
    const { app, service, store } = memoryService();
    app.serviceOutput = mock((..._args: unknown[]) => {});
    store.scopes.global.push({ id: "NOT valid", grantedAt: "2026-11-16T09:12:00Z" });
    expect(service.matches("not.valid")).toBeUndefined();
    expect(service.list()[0]?.ignoredReason).toBeDefined();
  });

  it("unions the workspace grants and reports each grant's source", async () => {
    const { service, store } = memoryService();
    store.scopes.workspace.push({ id: "reddit.me.post", grantedAt: "2026-11-16T09:12:00Z" });
    await service.grant({ id: "x.acct.post" });
    expect(service.list().map(grant => `${grant.id}:${grant.source}`)).toEqual(["reddit.me.post:workspace", "x.acct.post:global"]);
    expect(service.matches("reddit.me.post")?.source).toBe("workspace");
  });

  it("revoke removes the exact entry from whichever scope holds it", async () => {
    const { service, store } = memoryService();
    store.scopes.workspace.push({ id: "reddit.me.post", grantedAt: "2026-11-16T09:12:00Z" });
    store.scopes.global.push({ id: "blog.*.publish", grantedAt: "2026-11-16T09:12:00Z" });
    await service.grant({ id: "x.acct.post" });

    expect(await service.revoke("x.acct.post")).toBe(true);
    expect(service.matches("x.acct.post")).toBeUndefined();
    expect(await service.revoke("x.acct.post")).toBe(false);
    expect(await service.revoke("reddit.me.post")).toBe(true);
    expect(store.scopes.workspace).toHaveLength(0);
    // A wildcard entry is revoked by its own text; an exact id does not revoke the pattern covering it.
    expect(await service.revoke("blog.mysite.publish")).toBe(false);
    expect(service.matches("blog.mysite.publish")).toBeDefined();
    expect(await service.revoke("blog.*.publish")).toBe(true);
  });

  it("touch updates uses and lastUsedAt, in the list at once and in storage on flush", async () => {
    const { service, store } = memoryService();
    await service.grant({ id: "x.acct.post" });
    service.touch("x.acct.post");
    service.touch("x.acct.post");
    const [info] = service.list();
    expect(info?.uses).toBe(2);
    expect(info?.lastUsedAt).toBeDefined();
    expect(store.scopes.global[0]?.uses).toBeUndefined();

    await service.flush();
    expect(store.scopes.global[0]?.uses).toBe(2);
    expect(store.scopes.global[0]?.lastUsedAt).toBe(info!.lastUsedAt!);
    expect(service.list()[0]?.uses).toBe(2);

    service.touch("x.acct.post");
    await service.stop();
    expect(store.scopes.global[0]?.uses).toBe(3);
  });

  it("notifies subscribers of changes", async () => {
    const { service } = memoryService();
    let count = 0;
    const stop = service.onChange(() => count++);
    await service.grant({ id: "x.acct.post" });
    await service.revoke("x.acct.post");
    stop();
    await service.grant({ id: "x.acct.post" });
    expect(count).toBe(2);
  });

  it("concurrent grants all survive", async () => {
    const { service } = memoryService();
    const ids = Array.from({ length: 10 }, (_, index) => `blog.site${index}.publish`);
    await Promise.all(ids.map(id => service.grant({ id })));
    expect(
      service
        .list()
        .map(grant => grant.id)
        .sort(),
    ).toEqual([...ids].sort());
  });
});

describe("PermissionService saving to the config overlay", () => {
  let dir: string;
  let globalFile: string;
  let workspaceFile: string;
  let app: TokenRingApp;
  let service: PermissionService;
  let configuration: ConfigurationService;

  const pluginSchema = z.object({ chat: ChatServiceConfigSchema, other: z.object({ name: z.string().default("n") }).prefault({}) });
  const composed = z.object({ ...TokenRingAppConfigSchema.shape, ...pluginSchema.shape });
  const plugin = {
    name: "chat-test",
    displayName: "Chat test",
    version: "1.0.0",
    description: "Config slices for permission tests",
    configSchema: pluginSchema,
    reconfigure: () => {},
  } satisfies TokenRingPlugin<typeof pluginSchema>;

  async function setup(globalConfig: Record<string, unknown> = {}) {
    app = new TokenRingApp(composed.parse({ app: { workingDirectory: "/tmp", workspaceDirectory: "/tmp", configDirectories: [] } }), { globalConfig });
    configuration = new ConfigurationService(app, { configSchema: composed, overridesFiles: { global: globalFile, workspace: workspaceFile } });
    app.addService(ConfigurationService, configuration);
    const manager = app.addService(PluginManager, new PluginManager(app));
    await manager.installPlugins([plugin]);
    service = new PermissionService(app);
  }

  const readGlobal = () =>
    YAML.parse(fs.readFileSync(globalFile, "utf8")) as { chat?: { permissions?: { grants?: { id: string; uses?: number }[] } }; other?: unknown };

  beforeEach(() => {
    dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "permissions-")));
    globalFile = path.join(dir, "home", ".tokenring", "config.yaml");
    workspaceFile = path.join(dir, "workspace", "config.yaml");
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("persists a grant under chat.permissions.grants of the global overlay", async () => {
    await setup();
    await service.grant({ id: "blog.mysite.publish", summary: "Publish posts on mysite" });
    const saved = readGlobal().chat?.permissions?.grants;
    expect(saved).toHaveLength(1);
    expect(saved?.[0]).toMatchObject({ id: "blog.mysite.publish", note: "Publish posts on mysite" });
    expect(service.matches("blog.mysite.publish")).toBeDefined();

    expect(await service.revoke("blog.mysite.publish")).toBe(true);
    expect(readGlobal()?.chat).toBeUndefined();
  });

  it("concurrent saves do not lose grants or other config edits", async () => {
    await setup({ other: { name: "kept" } });
    const ids = Array.from({ length: 8 }, (_, index) => `x.acct${index}.post`);
    await Promise.all([...ids.map(id => service.grant({ id })), configuration.update("global", layer => void (layer.other = { name: "edited" }))]);
    const file = readGlobal();
    expect(file.chat?.permissions?.grants?.map(grant => grant.id).sort()).toEqual([...ids].sort());
    expect(file.other).toEqual({ name: "edited" });
    expect(service.list()).toHaveLength(ids.length);
  });

  it("saves usage from touch on flush without dropping grants", async () => {
    await setup();
    await service.grant({ id: "x.acct.post" });
    await service.grant({ id: "x.other.post" });
    service.touch("x.acct.post");
    await service.flush();
    const grants = readGlobal().chat?.permissions?.grants ?? [];
    expect(grants.find(grant => grant.id === "x.acct.post")?.uses).toBe(1);
    expect(grants).toHaveLength(2);
  });

  it("reads grants from the workspace overlay too", async () => {
    await setup();
    await configuration.update("workspace", layer => {
      layer.chat = { permissions: { grants: [{ id: "reddit.me.post", grantedAt: "2026-11-16T09:12:00Z" }] } };
    });
    expect(service.matches("reddit.me.post")?.source).toBe("workspace");
    expect(await service.revoke("reddit.me.post")).toBe(true);
    expect(service.matches("reddit.me.post")).toBeUndefined();
  });

  it("refuses to load or save grants from a config file inside a folder agents can write", async () => {
    await setup({ chat: { permissions: { grants: [{ id: "x.acct.post", grantedAt: "2026-11-16T09:12:00Z" }] } } });
    const output = mock((..._args: unknown[]) => {});
    app.serviceOutput = output;
    expect(service.matches("x.acct.post")?.id).toBe("x.acct.post");

    service.setWritableRootsProvider(() => [path.join(dir, "home")]);
    expect(service.matches("x.acct.post")).toBeUndefined();
    expect(service.list()[0]?.ignoredReason).toMatch(/inside .*agents' file tools can write/);
    expect(String(output.mock.calls[0]?.[1])).toMatch(/Ignoring permission grants from the global configuration/);
    await expect(service.grant({ id: "x.other.post" })).rejects.toBeInstanceOf(PermissionError);

    // A folder that does not contain the file changes nothing.
    service.setWritableRootsProvider(() => [path.join(dir, "elsewhere")]);
    expect(service.matches("x.acct.post")).toBeDefined();
    // Revoking is always allowed.
    service.setWritableRootsProvider(() => [dir]);
    expect(await service.revoke("x.acct.post")).toBe(true);
  });
});
