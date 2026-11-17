import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Agent from "@tokenring-ai/agent/Agent";
import { ALWAYS_ALLOW_VALUE } from "@tokenring-ai/agent/question";
import AgentJobService from "@tokenring-ai/agent/services/AgentJobService";
import AgentManager from "@tokenring-ai/agent/services/AgentManager";
import createTestingAgent from "@tokenring-ai/agent/test/createTestingAgent.test";
import type TokenRingApp from "@tokenring-ai/app";
import createTestingApp from "@tokenring-ai/app/test/createTestingApp.test";
import ChatService from "./ChatService.ts";
import permissionsList from "./commands/permissions/list.ts";
import permissionsRevoke from "./commands/permissions/revoke.ts";
import PermissionService, { MemoryPermissionStore } from "./PermissionService.ts";
import type { ParsedChatConfig } from "./schema.ts";
import chatTools from "./tools.ts";

type Tree = { name: string; value: string }[];

function setup(rootConfig: Partial<ParsedChatConfig> = { autoToolApprovalLevel: 2, toolApprovalMode: "ask" }) {
  const app = createTestingApp() as TokenRingApp;
  const root = createTestingAgent(app);
  const agentManager = app.requireService(AgentManager);
  agentManager.addAgentConfigs(root.config);
  const child = agentManager.spawnSubAgent(root, root.config.agentType, {});

  const configs = new Map<string, Partial<ParsedChatConfig>>([[root.id, rootConfig]]);
  const chat = new ChatService(app);
  chat.getChatConfig = (agent: Agent) => (configs.get(agent.id) ?? { autoToolApprovalLevel: 6, toolApprovalMode: "auto" }) as ParsedChatConfig;
  const store = new MemoryPermissionStore();
  const permissions = app.addService(PermissionService, new PermissionService(app, store));

  // Answers questions the way a person would, and remembers what was offered.
  const questions: { message: string; tree: Tree }[] = [];
  let answer: string[] | null = ["Approved"];
  const answerWith = (value: string | null) => {
    answer = value === null ? null : [value];
  };
  const wire = (agent: Agent) => {
    agent.askQuestion = (async (input: { message: string; question: { tree: Tree } }) => {
      questions.push({ message: input.message, tree: input.question.tree });
      return answer;
    }) as unknown as Agent["askQuestion"];
    agent.infoMessage = ((...messages: string[]) => void infos.push(messages.join(" "))) as Agent["infoMessage"];
  };
  const infos: string[] = [];
  wire(root);
  wire(child);

  const publish = { id: "blog.mysite.publish", summary: "Publish posts on mysite" };
  const request = (safetyLevel: number, permission: { id: string; summary: string } | null = publish) => ({
    message: "publish the post",
    detailedDescription: "makes it public",
    safetyLevel,
    toolName: "blog_updatePost",
    ...(permission && { permission }),
  });
  return { app, root, child, agentManager, chat, store, permissions, configs, questions, infos, answerWith, request, wire, publish };
}

describe("checkToolApproval with a permission grant", () => {
  it("approves without asking in every approval mode, and tells the agent", async () => {
    for (const toolApprovalMode of ["ask", "reject", "auto"] as const) {
      const { chat, root, permissions, questions, infos, request, configs } = setup();
      configs.set(root.id, { autoToolApprovalLevel: 2, toolApprovalMode });
      await permissions.grant({ id: "blog.mysite.publish" });
      expect(await chat.checkToolApproval(request(8), root)).toBe(true);
      expect(questions).toHaveLength(0);
      expect(infos).toContain("Allowed by permission `blog.mysite.publish`");
    }
  });

  it("only covers the matching id", async () => {
    const { chat, root, permissions, questions, request, answerWith } = setup();
    await permissions.grant({ id: "blog.mysite.publish" });
    answerWith("Not approved");
    expect(await chat.checkToolApproval(request(8, { id: "blog.other.publish", summary: "Publish on other" }), root)).toBe(false);
    expect(questions).toHaveLength(1);
  });

  it("honours hand-written wildcard grants", async () => {
    const { chat, root, store, questions, request } = setup();
    store.scopes.global.push({ id: "blog.*.publish", grantedAt: "2026-11-16T09:12:00Z" });
    expect(await chat.checkToolApproval(request(8), root)).toBe(true);
    expect(questions).toHaveLength(0);
  });

  it("level 8 is grantable; 9 and 10 ignore grants, offer no Always, and still ask", async () => {
    const { chat, root, store, questions, request } = setup();
    store.scopes.global.push({ id: "blog.mysite.publish", grantedAt: "2026-11-16T09:12:00Z" });
    expect(await chat.checkToolApproval(request(8), root)).toBe(true);
    expect(questions).toHaveLength(0);
    for (const level of [9, 10]) {
      root.warningMessage = () => {};
      expect(await chat.checkToolApproval(request(level), root)).toBe(true);
    }
    expect(questions).toHaveLength(2);
    for (const question of questions) expect(question.tree.map(option => option.value)).toEqual(["Approved", "Not approved"]);
  });

  it("a lowered ceiling stops grants above it", async () => {
    const { chat, root, permissions, questions, request } = setup();
    await permissions.grant({ id: "blog.mysite.publish" });
    permissions.reconfigure({ maxGrantLevel: 7 });
    await chat.checkToolApproval(request(8), root);
    expect(questions).toHaveLength(1);
    expect(questions[0]?.tree).toHaveLength(2);
  });

  it("a sub-agent honours the grant", async () => {
    const { chat, child, permissions, questions, request, configs, root } = setup();
    configs.set(root.id, { autoToolApprovalLevel: 2, toolApprovalMode: "reject" });
    expect(await chat.checkToolApproval(request(8), child)).toBe(false);
    await permissions.grant({ id: "blog.mysite.publish" });
    expect(await chat.checkToolApproval(request(8), child)).toBe(true);
    expect(questions).toHaveLength(0);
  });

  it("records use: uses and lastUsedAt", async () => {
    const { chat, root, permissions, request } = setup();
    await permissions.grant({ id: "blog.mysite.publish" });
    await chat.checkToolApproval(request(8), root);
    await chat.checkToolApproval(request(8), root);
    const [info] = permissions.list();
    expect(info?.uses).toBe(2);
    expect(info?.lastUsedAt).toBeDefined();
  });

  it("revoking restores asking", async () => {
    const { chat, root, permissions, questions, request } = setup();
    await permissions.grant({ id: "blog.mysite.publish" });
    await permissions.revoke("blog.mysite.publish");
    await chat.checkToolApproval(request(8), root);
    expect(questions).toHaveLength(1);
  });
});

describe("the Always allow answer", () => {
  it("offers Yes, No and Always allow for a request with a permission", async () => {
    const { chat, root, questions, request } = setup();
    await chat.checkToolApproval(request(8), root);
    expect(questions[0]?.tree).toEqual([
      { name: "Approve", value: "Approved" },
      { name: "Not now", value: "Not approved" },
      { name: "Always allow: Publish posts on mysite", value: ALWAYS_ALLOW_VALUE },
    ]);
  });

  it("offers it in auto mode when the classifier falls back to asking", async () => {
    const { chat, root, questions, request, configs } = setup();
    configs.set(root.id, { autoToolApprovalLevel: 2, toolApprovalMode: "auto" });
    await chat.checkToolApproval(request(8), root);
    expect(questions[0]?.tree.map(option => option.value)).toContain(ALWAYS_ALLOW_VALUE);
  });

  it("saves exactly one grant and approves", async () => {
    const { chat, root, permissions, store, questions, request, answerWith } = setup();
    answerWith(ALWAYS_ALLOW_VALUE);
    expect(await chat.checkToolApproval(request(8), root)).toBe(true);
    expect(store.scopes.global).toHaveLength(1);
    expect(store.scopes.global[0]).toMatchObject({ id: "blog.mysite.publish", note: "Publish posts on mysite" });
    expect(permissions.matches("blog.mysite.publish")).toBeDefined();

    // The next request is covered.
    expect(await chat.checkToolApproval(request(8), root)).toBe(true);
    expect(questions).toHaveLength(1);
    expect(store.scopes.global).toHaveLength(1);
  });

  it("still approves this request when the grant cannot be saved", async () => {
    const { chat, root, store, request, answerWith } = setup();
    const warnings: string[] = [];
    root.warningMessage = ((...messages: string[]) => void warnings.push(messages.join(" "))) as Agent["warningMessage"];
    store.update = async () => {
      throw new Error("disk full");
    };
    answerWith(ALWAYS_ALLOW_VALUE);
    expect(await chat.checkToolApproval(request(8), root)).toBe(true);
    expect(warnings.join()).toMatch(/could not be saved: disk full/);
  });

  it("Yes approves and No refuses, without saving anything", async () => {
    const { chat, root, store, request, answerWith } = setup();
    answerWith("Approved");
    expect(await chat.checkToolApproval(request(8), root)).toBe(true);
    answerWith("Not approved");
    expect(await chat.checkToolApproval(request(8), root)).toBe(false);
    answerWith(null);
    expect(await chat.checkToolApproval(request(8), root)).toBe(false);
    expect(store.scopes.global).toHaveLength(0);
  });

  it("a request without a permission offers only Yes and No, and an Always answer is not an approval", async () => {
    const { chat, root, store, questions, request, answerWith } = setup();
    await chat.checkToolApproval(request(8, null), root);
    expect(questions[0]?.tree.map(option => option.value)).toEqual(["Approved", "Not approved"]);
    answerWith(ALWAYS_ALLOW_VALUE);
    expect(await chat.checkToolApproval(request(8, null), root)).toBe(false);
    expect(store.scopes.global).toHaveLength(0);
  });

  it("an invalid permission id behaves like no permission", async () => {
    const { chat, root, questions, request } = setup();
    await chat.checkToolApproval(request(8, { id: "Blog My Site", summary: "x" }), root);
    expect(questions[0]?.tree).toHaveLength(2);
  });

  it("Agent.askForApproval without alwaysAllow offers exactly Yes and No", async () => {
    const { root, questions } = setup();
    root.askQuestion = (async (input: { message: string; question: { tree: Tree } }) => {
      questions.push({ message: input.message, tree: input.question.tree });
      return ["Approved"];
    }) as unknown as Agent["askQuestion"];
    expect(await root.askForApproval({ message: "ok?" })).toBe(true);
    expect(questions[0]?.tree).toEqual([
      { name: "Approve", value: "Approved" },
      { name: "Not now", value: "Not approved" },
    ]);
  });
});

describe("unattended jobs", () => {
  function jobSetup() {
    const ctx = setup({ autoToolApprovalLevel: 8, toolApprovalMode: "ask" });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perm-jobs-"));
    const jobs = ctx.app.addService(AgentJobService, new AgentJobService(ctx.app, { recordsFile: path.join(dir, "jobs.json") }));
    ctx.chat.updateChatConfig = (patch: Partial<ParsedChatConfig>, agent: Agent) => {
      ctx.configs.set(agent.id, { ...ctx.configs.get(agent.id), ...patch });
    };
    jobs.setChatIntegration(ctx.chat.jobIntegration());
    return {
      ...ctx,
      jobs,
      cleanup: () => {
        jobs.stop();
        fs.rmSync(dir, { recursive: true, force: true });
      },
    };
  }

  it("a job agent honours a grant, though its approval cap is lower", async () => {
    const { chat, root, jobs, permissions, request, cleanup, infos } = jobSetup();
    try {
      const job = jobs.startJob({ owner: "scheduler", label: "post", agentType: root.config.agentType, origin: { kind: "agent", agent: root } });
      job.agent.answerTimeoutSeconds = 0;
      job.agent.infoMessage = ((...messages: string[]) => void infos.push(messages.join(" "))) as Agent["infoMessage"];
      expect(chat.approvalPolicy(job.agent).autoToolApprovalLevel).toBeLessThan(8);
      await permissions.grant({ id: "blog.mysite.publish" });
      expect(await chat.checkToolApproval(request(8), job.agent)).toBe(true);
      expect(infos).toContain("Allowed by permission `blog.mysite.publish`");
      expect(jobs.list()[0]?.refusalCount).toBe(0);
    } finally {
      cleanup();
    }
  });

  it("a refusal in a job records the permission id and summary, so the person can allow it", async () => {
    const { chat, root, jobs, request, cleanup } = jobSetup();
    try {
      const job = jobs.startJob({ owner: "scheduler", label: "post", agentType: root.config.agentType, origin: { kind: "agent", agent: root } });
      job.agent.answerTimeoutSeconds = 0;
      expect(await chat.checkToolApproval(request(8), job.agent)).toBe(false);
      expect(await chat.checkToolApproval(request(8, null), job.agent)).toBe(false);
      const record = jobs.list()[0];
      expect(record?.refusalCount).toBe(2);
      expect(record?.refusals[0]).toMatchObject({
        tool: "blog_updatePost",
        level: 8,
        permissionId: "blog.mysite.publish",
        permissionSummary: "Publish posts on mysite",
      });
      expect(record?.refusals[1]).not.toHaveProperty("permissionId");
      // Level 9 can never be allowed, so no id is offered for it.
      expect(await chat.checkToolApproval(request(9), job.agent)).toBe(false);
      expect(jobs.list()[0]?.refusals[2]).not.toHaveProperty("permissionId");
    } finally {
      cleanup();
    }
  });
});

describe("/permissions", () => {
  it("lists grants and revokes by exact id", async () => {
    const { root, permissions } = setup();
    expect(await permissionsList.execute({ args: {}, agent: root } as never)).toMatch(/No permissions are granted/);
    await permissions.grant({ id: "blog.mysite.publish", summary: "Publish posts on mysite" });
    const listing = (await permissionsList.execute({ args: {}, agent: root } as never)) as string;
    expect(listing).toContain("`blog.mysite.publish` — Publish posts on mysite");
    expect(listing).toContain("never used");
    expect(listing).toContain("from global config");

    await expect(permissionsRevoke.execute({ args: { id: "blog.*.publish" }, agent: root } as never)).rejects.toThrow(/no permission/);
    expect(await permissionsRevoke.execute({ args: { id: "blog.mysite.publish" }, agent: root } as never)).toMatch(/Revoked/);
    expect(permissions.list()).toHaveLength(0);
  });
});

describe("agents cannot create grants", () => {
  it("the chat plugin's tools have nothing to do with permissions", () => {
    for (const tool of chatTools) {
      expect(tool.name.toLowerCase()).not.toMatch(/permission|grant/);
    }
  });

  it("no tool source in any plugin uses PermissionService", () => {
    const pluginsDir = path.resolve(import.meta.dir, "..");
    const offenders: string[] = [];
    const walk = (dir: string, inTools: boolean) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, inTools || entry.name === "tools");
        else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") && (inTools || entry.name === "tools.ts")) {
          if (/PermissionService|\.grant\(\s*\{/.test(fs.readFileSync(full, "utf8"))) offenders.push(path.relative(pluginsDir, full));
        }
      }
    };
    for (const plugin of fs.readdirSync(pluginsDir, { withFileTypes: true })) {
      if (plugin.isDirectory()) walk(path.join(pluginsDir, plugin.name), false);
    }
    expect(offenders).toEqual([]);
  });
});
