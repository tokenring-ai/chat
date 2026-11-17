import { describe, expect, it } from "bun:test";
import AgentManager from "@tokenring-ai/agent/services/AgentManager";
import SubAgentService from "@tokenring-ai/agent/services/SubAgentService";
import { AgentEventState } from "@tokenring-ai/agent/state/agentEventState";
import createTestingAgent from "@tokenring-ai/agent/test/createTestingAgent.test";
import type TokenRingApp from "@tokenring-ai/app";
import createTestingApp from "@tokenring-ai/app/test/createTestingApp.test";
import subAgents from "./subAgents.ts";

const tool = (name: string) => subAgents.find(candidate => candidate.name === name)!;

describe("sub-agent tools", () => {
  it("start, send, output, list and stop act on the calling agent's own sub-agents", async () => {
    const app = createTestingApp() as TokenRingApp;
    const parent = createTestingAgent(app);
    app.addService(SubAgentService, new SubAgentService(app));
    const agentManager = app.requireService(AgentManager);
    agentManager.addAgentConfigs(parent.config);
    const other = agentManager.spawnAgentFromConfig(parent.config);

    const started = await tool("agent_start").execute({ agentType: "mock-agent", message: "look around", name: "scout", notify: true } as never, parent);
    expect(started.result).toContain("Started scout");

    const listed = await tool("agent_list").execute({} as never, parent);
    expect(listed.result).toContain("- scout (mock-agent): working");
    expect(listed.result).toContain("- mock-agent: A mock agent for testing purposes");

    const record = app.requireService(SubAgentService).listSubAgents(parent)[0]!;
    const child = agentManager.getAgent(record.agentId)!;
    await tool("agent_send").execute({ name: "scout", message: "also check tests" } as never, parent);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(child.getState(AgentEventState).events.filter(event => event.type === "input.received")).toHaveLength(2);

    const output = await tool("agent_output").execute({ name: "scout", waitSeconds: 0 } as never, parent);
    expect(output.result).toContain("scout (mock-agent): working");

    // Another agent cannot reach this one's sub-agents.
    await expect(tool("agent_stop").execute({ name: "scout" } as never, other)).rejects.toThrow("No sub-agent named scout");
    await expect(tool("agent_start").execute({ agentType: "nope", message: "x", notify: true } as never, parent)).rejects.toThrow('no agent type "nope"');

    await tool("agent_stop").execute({ name: "scout" } as never, parent);
    expect(agentManager.getAgent(child.id)).toBeNull();
    expect((await tool("agent_list").execute({} as never, parent)).result).toContain("- scout (mock-agent): closed");
    // Messaging it again resumes it from where it stopped.
    expect((await tool("agent_send").execute({ name: "scout", message: "back to work" } as never, parent)).result).toContain("Sent to scout.");
    expect((await tool("agent_list").execute({} as never, parent)).result).toContain("- scout (mock-agent): working");
    agentManager.deleteAgent(parent.id, "done");
    agentManager.deleteAgent(other.id, "done");
  });
});
