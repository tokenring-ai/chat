import fs from "node:fs";
import path from "node:path";
import type TokenRingApp from "@tokenring-ai/app";
import ConfigurationService from "@tokenring-ai/app/config/ConfigurationService";
import type { TokenRingService } from "@tokenring-ai/app/types";
import { isPlainObject } from "@tokenring-ai/utility/object/isPlainObject";
import { hasWildcard, permissionIdProblem, permissionPatternMatches } from "./permissions/permissionIds.ts";
import { MAX_GRANTABLE_LEVEL, type PermissionGrantConfig, PermissionGrantSchema } from "./schema.ts";

/** Where a grant is stored: the user's global config, or the workspace config (which takes precedence). */
export type GrantSource = "global" | "workspace";
const SOURCES: GrantSource[] = ["global", "workspace"];

export type PermissionGrantInfo = {
  /** The grant's id; hand-written grants may contain `*` / `**` wildcards. */
  id: string;
  /** What the grant covers in plain language, when known. */
  summary?: string;
  grantedAt: string;
  lastUsedAt?: string;
  uses: number;
  source: GrantSource;
  /** Set when the grant is listed but never approves anything, and why. */
  ignoredReason?: string;
};

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

/** Where grants are persisted. The default writes the chat config overlay through {@link ConfigurationService}. */
export interface PermissionStore {
  /** The raw grants of one scope. */
  read(scope: GrantSource): unknown[];
  /** Read-modify-write of one scope's grants, serialised with every other config write. */
  update(scope: GrantSource, mutate: (grants: PermissionGrantConfig[]) => void): Promise<void>;
  /** The file the scope is saved to, when it is a file. */
  filePath(scope: GrantSource): string | undefined;
}

type GrantsHolder = { chat?: { permissions?: { grants?: unknown } } };

/** Grants live under `chat.permissions.grants` of the global / workspace config overlay. */
export class ConfigurationPermissionStore implements PermissionStore {
  constructor(private readonly app: TokenRingApp) {}

  private get configuration(): ConfigurationService | undefined {
    return this.app.getService(ConfigurationService);
  }

  read(scope: GrantSource): unknown[] {
    const grants = (this.configuration?.getOverrides(scope) as GrantsHolder | undefined)?.chat?.permissions?.grants;
    return Array.isArray(grants) ? grants : [];
  }

  async update(scope: GrantSource, mutate: (grants: PermissionGrantConfig[]) => void): Promise<void> {
    const configuration = this.configuration;
    if (!configuration) throw new PermissionError("The configuration service is not available, so permissions cannot be saved.");
    const result = await configuration.update(scope, layer => {
      const chat = isPlainObject(layer.chat) ? (layer.chat as Record<string, unknown>) : {};
      const permissions = isPlainObject(chat.permissions) ? (chat.permissions as Record<string, unknown>) : {};
      const grants = (Array.isArray(permissions.grants) ? permissions.grants : []) as PermissionGrantConfig[];
      mutate(grants);
      if (grants.length > 0) permissions.grants = grants;
      else delete permissions.grants;
      if (Object.keys(permissions).length > 0) chat.permissions = permissions;
      else delete chat.permissions;
      if (Object.keys(chat).length > 0) layer.chat = chat;
      else delete layer.chat;
    });
    if (!result.ok)
      throw new PermissionError(`Could not save the permissions: ${result.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  }

  filePath(scope: GrantSource): string | undefined {
    return this.configuration?.overridesFiles[scope];
  }
}

/** In-memory store for tests and hosts without a configuration service. */
export class MemoryPermissionStore implements PermissionStore {
  readonly scopes: Record<GrantSource, PermissionGrantConfig[]> = { global: [], workspace: [] };
  private queue: Promise<unknown> = Promise.resolve();

  /** `files` names the file each scope pretends to be saved in (for the writable-folder check). */
  constructor(private readonly files: Partial<Record<GrantSource, string>> = {}) {}

  read(scope: GrantSource): unknown[] {
    return structuredClone(this.scopes[scope]);
  }

  update(scope: GrantSource, mutate: (grants: PermissionGrantConfig[]) => void): Promise<void> {
    const run = this.queue.then(() => {
      const next = structuredClone(this.scopes[scope]);
      mutate(next);
      this.scopes[scope] = next;
    });
    this.queue = run.catch(() => {});
    return run;
  }

  filePath(scope: GrantSource): string | undefined {
    return this.files[scope];
  }
}

const USAGE_FLUSH_MS = 1500;

function containedIn(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/** realpath of the longest existing ancestor of `target`, re-joined with the rest. */
function realPathOf(target: string): string {
  let current = path.resolve(target);
  const rest: string[] = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync(current), ...rest);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target);
      rest.unshift(path.basename(current));
      current = parent;
    }
  }
}

/**
 * Standing permissions ("Always allow"). A tool that asks for approval can name the kind of action
 * with a permission id (see `CheckToolApprovalOptions.permission`); a matching grant approves the
 * request without asking, at any approval level up to {@link maxGrantLevel}, for every agent
 * including unattended jobs. Only a person's answer, the `/permissions` command or the Permissions
 * UI creates or removes a grant: no agent tool does.
 */
export default class PermissionService implements TokenRingService {
  readonly name = "PermissionService";
  readonly description = "Standing permissions that approve specific actions without asking";

  private maxLevel: number = MAX_GRANTABLE_LEVEL;
  private writableRoots: (() => string[]) | undefined;
  private readonly summaries = new Map<string, string>();
  private readonly pendingUsage = new Map<string, { source: GrantSource; id: string; uses: number; lastUsedAt: string }>();
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly warned = new Set<string>();
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly app: TokenRingApp,
    private readonly store: PermissionStore = new ConfigurationPermissionStore(app),
  ) {}

  /** Applies `chat.permissions` config. The ceiling can only lower the schema maximum of 8. */
  reconfigure(config: { maxGrantLevel?: number | undefined }): void {
    this.maxLevel = Math.min(MAX_GRANTABLE_LEVEL, Math.max(0, config.maxGrantLevel ?? MAX_GRANTABLE_LEVEL));
    this.notify();
  }

  /** The highest approval level a grant may cover (at most 8). Requests above it always ask a person. */
  get maxGrantLevel(): number {
    return this.maxLevel;
  }

  /**
   * Registers what agents' file tools may write. A config file inside one of those folders could be
   * edited by an agent, so grants are not loaded from it.
   */
  setWritableRootsProvider(provider: (() => string[]) | undefined): void {
    this.writableRoots = provider;
  }

  /** Whether a request at `level` can be covered by a grant (and so may offer "Always allow"). */
  canGrantLevel(level: number): boolean {
    return level <= this.maxLevel;
  }

  /** Why grants of `scope` cannot be trusted, or undefined when they can. */
  untrustedReason(scope: GrantSource): string | undefined {
    const file = this.store.filePath(scope);
    const roots = this.writableRoots?.() ?? [];
    if (!file || roots.length === 0) return undefined;
    const realFile = realPathOf(file);
    for (const root of roots) {
      if (containedIn(path.resolve(root), path.resolve(file)) || containedIn(realPathOf(root), realFile)) {
        return `${file} is inside ${root}, which agents' file tools can write, so an agent could grant itself permissions there`;
      }
    }
    return undefined;
  }

  /** Every grant of both scopes, usage included; ones that cannot approve anything carry `ignoredReason`. */
  list(): PermissionGrantInfo[] {
    const infos: PermissionGrantInfo[] = [];
    for (const source of SOURCES) {
      const untrusted = this.untrustedReason(source);
      if (untrusted) this.warnOnce(`untrusted:${source}`, `Ignoring permission grants from the ${source} configuration: ${untrusted}.`);
      for (const raw of this.store.read(source)) {
        const parsed = PermissionGrantSchema.safeParse(raw);
        if (!parsed.success) continue;
        const grant = parsed.data;
        const problem = permissionIdProblem(grant.id, { allowWildcards: true });
        if (problem) this.warnOnce(`bad:${grant.id}`, `Ignoring permission grant "${grant.id}": ${problem}`);
        const pending = this.pendingUsage.get(this.usageKey(source, grant.id));
        const summary = this.summaries.get(grant.id) ?? grant.note;
        const ignoredReason = problem ?? (untrusted ? `Not trusted: ${untrusted}` : undefined);
        infos.push({
          id: grant.id,
          ...(summary !== undefined && { summary }),
          grantedAt: grant.grantedAt,
          ...((pending?.lastUsedAt ?? grant.lastUsedAt) !== undefined && { lastUsedAt: (pending?.lastUsedAt ?? grant.lastUsedAt)! }),
          uses: (grant.uses ?? 0) + (pending?.uses ?? 0),
          source,
          ...(ignoredReason !== undefined && { ignoredReason }),
        });
      }
    }
    return infos.sort((a, b) => a.id.localeCompare(b.id) || a.source.localeCompare(b.source));
  }

  /**
   * The grant that covers the exact permission id `id` (exact grants before wildcard ones, global
   * before workspace), or undefined. Level limits are not applied here; see {@link findGrantFor}.
   */
  matches(id: string): PermissionGrantInfo | undefined {
    if (permissionIdProblem(id) !== null) return undefined;
    const usable = this.list().filter(info => info.ignoredReason === undefined && permissionPatternMatches(info.id, id));
    return usable.find(info => !hasWildcard(info.id)) ?? usable[0];
  }

  /**
   * The grant that approves a request with permission `id` at approval `level`, or undefined.
   * Levels above the ceiling (always 9-10) never match: a hand-written grant is ignored with a warning.
   */
  findGrantFor(id: string, level: number): PermissionGrantInfo | undefined {
    const grant = this.matches(id);
    if (!grant) return undefined;
    if (!this.canGrantLevel(level)) {
      this.warnOnce(
        `level:${grant.id}:${level}`,
        `Ignoring permission grant "${grant.id}" for "${id}": the request is at safety level ${level}, above the grantable maximum of ${this.maxLevel}.`,
      );
      return undefined;
    }
    return grant;
  }

  /**
   * Saves a grant for an exact id in the global config. Rejects wildcards and a `level` above the
   * ceiling. Granting an id that already has an exact grant changes nothing.
   */
  async grant({
    id,
    summary,
    level,
    note,
  }: {
    id: string;
    summary?: string | undefined;
    level?: number | undefined;
    note?: string | undefined;
  }): Promise<PermissionGrantInfo> {
    const problem = permissionIdProblem(id);
    if (problem) throw new PermissionError(problem);
    if (level !== undefined && !this.canGrantLevel(level)) {
      throw new PermissionError(`Actions at safety level ${level} can't be allowed permanently; the highest grantable level is ${this.maxLevel}.`);
    }
    const untrusted = this.untrustedReason("global");
    if (untrusted) throw new PermissionError(`Permissions can't be saved: ${untrusted}.`);

    const text = (note ?? summary)?.trim();
    if (summary?.trim()) this.summaries.set(id, summary.trim());
    await this.store.update("global", grants => {
      if (grants.some(grant => grant.id === id)) return;
      grants.push({ id, grantedAt: new Date().toISOString(), ...(text && { note: text }) });
    });
    this.notify();
    const saved = this.list().find(info => info.id === id && info.source === "global");
    if (!saved) throw new PermissionError("The permission was not saved.");
    return saved;
  }

  /** Removes the grant entry whose id is exactly `id` from both scopes. True when one was removed. */
  async revoke(id: string): Promise<boolean> {
    if (permissionIdProblem(id, { allowWildcards: true }) !== null) return false;
    const removedFrom: GrantSource[] = [];
    for (const source of SOURCES) {
      if (!this.store.read(source).some(raw => isPlainObject(raw) && (raw as { id?: unknown }).id === id)) continue;
      await this.store.update(source, grants => {
        const kept = grants.filter(grant => grant.id !== id);
        if (kept.length !== grants.length) {
          removedFrom.push(source);
          grants.splice(0, grants.length, ...kept);
        }
      });
      this.pendingUsage.delete(this.usageKey(source, id));
    }
    if (removedFrom.length > 0) this.notify();
    return removedFrom.length > 0;
  }

  /** Records that the grant `id` approved a request. Saved to config shortly after, batched. */
  touch(id: string, source?: GrantSource): void {
    const target = this.list().find(info => info.id === id && (source === undefined || info.source === source) && info.ignoredReason === undefined);
    if (!target) return;
    const key = this.usageKey(target.source, id);
    const pending = this.pendingUsage.get(key);
    this.pendingUsage.set(key, { source: target.source, id, uses: (pending?.uses ?? 0) + 1, lastUsedAt: new Date().toISOString() });
    this.flushTimer ??= setTimeout(() => void this.flush(), USAGE_FLUSH_MS);
    this.flushTimer.unref();
    this.notify();
  }

  /** Saves usage (last used, count) that has not been saved yet. */
  async flush(): Promise<void> {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    const batch = [...this.pendingUsage.values()];
    if (batch.length === 0) return;
    for (const source of SOURCES) {
      const entries = batch.filter(entry => entry.source === source);
      if (entries.length === 0) continue;
      try {
        await this.store.update(source, grants => {
          for (const entry of entries) {
            const grant = grants.find(candidate => candidate.id === entry.id);
            if (!grant) continue;
            grant.uses = (grant.uses ?? 0) + entry.uses;
            grant.lastUsedAt = entry.lastUsedAt;
          }
        });
        for (const entry of entries) {
          const key = this.usageKey(source, entry.id);
          const current = this.pendingUsage.get(key);
          if (!current) continue;
          // Uses recorded while this save ran stay pending.
          if (current.uses > entry.uses) this.pendingUsage.set(key, { ...current, uses: current.uses - entry.uses });
          else this.pendingUsage.delete(key);
        }
      } catch (error) {
        this.app.serviceError(this, "Could not save permission usage:", error);
      }
    }
  }

  /** Calls `listener` whenever grants or their usage change. Returns the unsubscribe function. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async stop(): Promise<void> {
    await this.flush();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // A broken subscriber must not stop approvals.
      }
    }
  }

  private usageKey(source: GrantSource, id: string): string {
    return `${source}\u0000${id}`;
  }

  private warnOnce(key: string, message: string): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.app.serviceOutput(this, `Warning: ${message}`);
  }
}
