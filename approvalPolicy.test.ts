import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Agent from "@tokenring-ai/agent/Agent";
import AgentJobService from "@tokenring-ai/agent/services/AgentJobService";
import AgentManager from "@tokenring-ai/agent/services/AgentManager";
import createTestingAgent from "@tokenring-ai/agent/test/createTestingAgent.test";
import type TokenRingApp from "@tokenring-ai/app";
import createTestingApp from "@tokenring-ai/app/test/createTestingApp.test";
import ChatService from "./ChatService.ts";
import { ChatServiceConfigSchema, type ParsedChatConfig } from "./schema.ts";

function setup() {
  const app = createTestingApp() as TokenRingApp;
  const root = createTestingAgent(app);
  const agentManager = app.requireService(AgentManager);
  agentManager.addAgentConfigs(root.config);
  const child = agentManager.spawnSubAgent(root, root.config.agentType, {});
  const grandchild = agentManager.spawnSubAgent(child, root.config.agentType, {});

  const configs = new Map<string, Partial<ParsedChatConfig>>([
    [root.id, { autoToolApprovalLevel: 8, toolApprovalMode: "ask" }],
    [child.id, { autoToolApprovalLevel: 2, toolApprovalMode: "reject" }],
    [grandchild.id, { autoToolApprovalLevel: 1, toolApprovalMode: "reject" }],
  ]);
  const chat = new ChatService(app);
  chat.getChatConfig = (agent: Agent) => configs.get(agent.id) as ParsedChatConfig;
  return { chat, root, child, grandchild, configs, agentManager };
}

describe("ChatService approval policy", () => {
  it("a sub-agent, at any depth, follows the top-level chat's current setting", async () => {
    const { chat, root, child, grandchild, configs } = setup();
    expect(chat.approvalPolicy(root)).toMatchObject({ autoToolApprovalLevel: 8, toolApprovalMode: "ask", policyAgent: root });
    expect(chat.approvalPolicy(child)).toMatchObject({ autoToolApprovalLevel: 8, toolApprovalMode: "ask", policyAgent: root });
    expect(chat.approvalPolicy(grandchild)).toMatchObject({ autoToolApprovalLevel: 8, policyAgent: root });

    // Approved without a question: within the user's level, though above the child's own.
    expect(await chat.checkToolApproval({ message: "edit a file", detailedDescription: "", safetyLevel: 5 }, child)).toBe(true);

    // Changing the setting in the user's chat applies to sub-agents already running.
    configs.set(root.id, { autoToolApprovalLevel: 3, toolApprovalMode: "reject" });
    expect(await chat.checkToolApproval({ message: "edit a file", detailedDescription: "", safetyLevel: 5 }, grandchild)).toBe(false);
  });

  it("falls back to the agent's own setting once its parent is gone", () => {
    const { chat, root, child, agentManager } = setup();
    agentManager.deleteAgent(root.id, "done");
    expect(chat.approvalPolicy(child)).toMatchObject({ autoToolApprovalLevel: 2, policyAgent: child });
  });
});

describe("ChatService approval policy of job agents", () => {
  function jobSetup() {
    const { chat, root, child, configs, agentManager } = setup();
    const app = root.app;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chat-jobs-"));
    const jobs = app.addService(AgentJobService, new AgentJobService(app, { recordsFile: path.join(dir, "jobs.json") }));
    // Agents the test did not configure have the stock defaults.
    chat.getChatConfig = (agent: Agent) => (configs.get(agent.id) ?? { autoToolApprovalLevel: 6, toolApprovalMode: "auto" }) as ParsedChatConfig;
    chat.updateChatConfig = (patch: Partial<ParsedChatConfig>, agent: Agent) => {
      configs.set(agent.id, { ...configs.get(agent.id), ...patch });
    };
    jobs.setChatIntegration(chat.jobIntegration());
    const cleanup = () => {
      jobs.stop();
      fs.rmSync(dir, { recursive: true, force: true });
    };
    return { chat, root, child, configs, agentManager, jobs, cleanup };
  }

  it("a job agent keeps the snapshot, capped, and its own sub-agents follow it rather than the chat", () => {
    const { chat, root, child, configs, agentManager, jobs, cleanup } = jobSetup();
    try {
      const job = jobs.startJob({ owner: "tasks", label: "review", agentType: root.config.agentType, origin: { kind: "agent", agent: child } });
      // Root allows 8 (in ask mode): the job gets the cap, 5, in the same mode.
      expect(chat.approvalPolicy(job.agent)).toMatchObject({ autoToolApprovalLevel: 5, toolApprovalMode: "ask", policyAgent: job.agent });

      const helper = agentManager.spawnSubAgent(job.agent, root.config.agentType, {});
      expect(chat.approvalPolicy(helper)).toMatchObject({ autoToolApprovalLevel: 5, policyAgent: job.agent });

      // The chat changing its setting no longer reaches the job; normal sub-agents still follow it.
      configs.set(root.id, { autoToolApprovalLevel: 10, toolApprovalMode: "auto" });
      expect(chat.approvalPolicy(job.agent).autoToolApprovalLevel).toBe(5);
      expect(chat.approvalPolicy(child)).toMatchObject({ autoToolApprovalLevel: 10, policyAgent: root });
    } finally {
      cleanup();
    }
  });

  it("a job started from a strict chat cannot exceed it", () => {
    const { chat, root, configs, jobs, cleanup } = jobSetup();
    try {
      configs.set(root.id, { autoToolApprovalLevel: 2, toolApprovalMode: "reject" });
      const job = jobs.startJob({ owner: "queue", label: "item", agentType: root.config.agentType, origin: { kind: "agent", agent: root } });
      expect(chat.approvalPolicy(job.agent)).toMatchObject({ autoToolApprovalLevel: 2, toolApprovalMode: "reject", policyAgent: job.agent });
    } finally {
      cleanup();
    }
  });

  it("a person's job gets chat.agentDefaults, capped", () => {
    const { chat, root, jobs, cleanup } = jobSetup();
    try {
      chat.reconfigure(ChatServiceConfigSchema.parse({ agentDefaults: { autoToolApprovalLevel: 7, toolApprovalMode: "auto" } }));
      const job = jobs.startJob({ owner: "queue", label: "item", agentType: root.config.agentType, origin: { kind: "person", label: "Me" } });
      expect(chat.approvalPolicy(job.agent)).toMatchObject({ autoToolApprovalLevel: 5, toolApprovalMode: "auto" });
    } finally {
      cleanup();
    }
  });
});

describe("ChatService approval standard in auto mode", () => {
  function autoSetup() {
    const { chat, root, configs } = setup();
    configs.set(root.id, { autoToolApprovalLevel: 6, toolApprovalMode: "auto" } as Partial<ParsedChatConfig>);
    const asked: string[] = [];
    root.askForApproval = (async ({ message }: { message: string }) => {
      asked.push(message);
      return true;
    }) as Agent["askForApproval"];
    // The classifier would wave everything through; it must not be consulted at 8 and above.
    let classified = 0;
    chat.requireModel = (() => {
      classified++;
      throw new Error("classifier should not run");
    }) as ChatService["requireModel"];
    return { chat, root, asked, classifiedCount: () => classified };
  }

  it("asks a person for actions that reach other people (level 8+), without the classifier", async () => {
    const { chat, root, asked, classifiedCount } = autoSetup();
    expect(await chat.checkToolApproval({ message: "send the email", detailedDescription: "to bob", safetyLevel: 8 }, root)).toBe(true);
    expect(await chat.checkToolApproval({ message: "drop the table", detailedDescription: "", safetyLevel: 9 }, root)).toBe(true);
    expect(asked).toHaveLength(2);
    expect(classifiedCount()).toBe(0);
  });

  it("approves actions within the auto-approve level without asking", async () => {
    const { chat, root, asked } = autoSetup();
    expect(await chat.checkToolApproval({ message: "trash an email", detailedDescription: "", safetyLevel: 6 }, root)).toBe(true);
    expect(asked).toHaveLength(0);
  });

  it("sends level 7 to the classifier (here failing, so it falls back to asking)", async () => {
    const { chat, root, asked, classifiedCount } = autoSetup();
    root.warningMessage = () => {};
    expect(await chat.checkToolApproval({ message: "upload to S3", detailedDescription: "", safetyLevel: 7 }, root)).toBe(true);
    expect(classifiedCount()).toBe(1);
    expect(asked).toHaveLength(1);
  });
});
