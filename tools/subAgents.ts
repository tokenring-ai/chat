import type Agent from "@tokenring-ai/agent/Agent";
import AgentManager from "@tokenring-ai/agent/services/AgentManager";
import SubAgentService, { MAX_WAIT_SECONDS, type SubAgentSnapshot } from "@tokenring-ai/agent/services/SubAgentService";
import { z } from "zod";
import type { TokenRingToolDefinition, TokenRingToolResult } from "../schema.ts";
import { ToolCallError } from "../util/tokenRingTool.ts";

/**
 * Background sub-agents, used like background terminals: start one, keep working, and its reply
 * arrives as a message once it finishes. See {@link SubAgentService}.
 */

function guard<T>(toolName: string, run: () => T): T {
  try {
    return run();
  } catch (error) {
    throw new ToolCallError(toolName, Error.isError(error) ? error.message : String(error));
  }
}

function describe(snapshot: SubAgentSnapshot): string {
  const lines = [`${snapshot.name} (${snapshot.agentType}): ${snapshot.status}`];
  if (snapshot.waitingFor) lines.push(`Waiting for the user to answer in its chat: ${snapshot.waitingFor}`);
  if (snapshot.reply !== null) lines.push("", "Reply:", snapshot.reply || "(empty)");
  else if (snapshot.output) lines.push("", "Output so far:", snapshot.output);
  return lines.join("\n");
}

const startSchema = z.object({
  agentType: z.string().describe("The type of agent to start, e.g. explore. agent_list shows the available types."),
  message: z.string().describe("What the sub-agent should do. It starts with no knowledge of this conversation, so include the context it needs."),
  name: z.string().exactOptional().describe("A short name to refer to it by, e.g. auth-research. Defaults to <agentType>-<n>."),
  notify: z.boolean().default(true).describe("Send you its reply as a message when it finishes (default). Set false to only check it with agent_output."),
});

const agentStart = {
  name: "agent_start",
  displayName: "Sub-agents/Start",
  description: `Start a sub-agent that works in the BACKGROUND while you carry on. Returns its name at once.

When it finishes you are sent its reply as a message, so do not poll it; continue with other work, or end your turn if you have nothing else to do. Use agent_send to give it follow-up instructions, and agent_stop when you no longer need it. Start several to work in parallel.`,
  inputSchema: startSchema,
  execute: async ({ agentType, message, name, notify }: z.output<typeof startSchema>, agent: Agent): Promise<TokenRingToolResult> => {
    const record = guard("agent_start", () => agent.requireService(SubAgentService).startSubAgent(agent, { agentType, messages: [message], name, notify }));
    return {
      message: `**Sub-agent** Started ${record.name} (${record.displayName})`,
      result: notify ? `Started ${record.name}. Its reply will be sent to you when it finishes.` : `Started ${record.name}. Check on it with agent_output.`,
    };
  },
} satisfies TokenRingToolDefinition<typeof startSchema>;

const sendSchema = z.object({
  name: z.string().describe("The sub-agent's name, from agent_start"),
  message: z.string().describe("The follow-up instruction or answer to send it"),
});

const agentSend = {
  name: "agent_send",
  displayName: "Sub-agents/Send",
  description:
    "Send a follow-up message to one of your sub-agents. It is queued if the sub-agent is still busy. A closed sub-agent (stopped, cleaned up after being idle, or lost in a restart) is resumed from where it left off. Like agent_start, its reply is sent to you when it finishes.",
  inputSchema: sendSchema,
  execute: async ({ name, message }: z.output<typeof sendSchema>, agent: Agent): Promise<TokenRingToolResult> => {
    let sent: Awaited<ReturnType<SubAgentService["sendToSubAgent"]>>;
    try {
      sent = await agent.requireService(SubAgentService).sendToSubAgent(agent, name, message);
    } catch (error) {
      throw new ToolCallError("agent_send", Error.isError(error) ? error.message : String(error));
    }
    const result = [`Sent to ${sent.record.name}.`];
    if (sent.unreadReply !== null) result.push("", "Its previous reply, which you had not read yet:", sent.unreadReply || "(empty)");
    return { message: `**Sub-agent** Sent a message to ${sent.record.name}`, result: result.join("\n") };
  },
} satisfies TokenRingToolDefinition<typeof sendSchema>;

const outputSchema = z.object({
  name: z.string().describe("The sub-agent's name, from agent_start"),
  waitSeconds: z
    .number()
    .int()
    .min(0)
    .max(MAX_WAIT_SECONDS)
    .default(0)
    .describe("Wait up to this long for it to finish (or need the user) before answering. 0 returns at once."),
});

const agentOutput = {
  name: "agent_output",
  displayName: "Sub-agents/Output",
  description:
    "Read what one of your sub-agents has produced since you last checked, and its status. Only needed when you want its result before it finishes on its own, or when you need it now: pass waitSeconds to wait for it.",
  inputSchema: outputSchema,
  execute: async ({ name, waitSeconds }: z.output<typeof outputSchema>, agent: Agent): Promise<TokenRingToolResult> => {
    const service = agent.requireService(SubAgentService);
    const signal = agent.getAbortSignal();
    let snapshot: SubAgentSnapshot;
    try {
      snapshot = await service.readSubAgent(agent, name, { waitSeconds, signal });
    } catch (error) {
      throw new ToolCallError("agent_output", Error.isError(error) ? error.message : String(error));
    }
    return { message: `**Sub-agent** Checked ${snapshot.name}: ${snapshot.status}`, result: describe(snapshot) };
  },
} satisfies TokenRingToolDefinition<typeof outputSchema>;

const listSchema = z.object({});

const agentList = {
  name: "agent_list",
  displayName: "Sub-agents/List",
  description: "List your sub-agents and their status, and the agent types you can start.",
  inputSchema: listSchema,
  execute: async (_args: z.output<typeof listSchema>, agent: Agent): Promise<TokenRingToolResult> => {
    const children = agent.requireService(SubAgentService).listSubAgents(agent);
    const types = agent
      .requireService(AgentManager)
      .getAgentConfigEntries()
      .map(([type, config]) => `- ${type}: ${config.description}`);
    const lines = [
      children.length > 0 ? "Your sub-agents (closed ones resume when you send them a message):" : "You have no sub-agents.",
      ...children.map(
        child =>
          `- ${child.name} (${child.agentType}): ${child.status}${child.waitingFor ? `, waiting for the user: ${child.waitingFor}` : ""}${child.reply !== null ? ", reply not read yet" : ""}`,
      ),
      "",
      "Agent types you can start:",
      ...types,
    ];
    return { message: `**Sub-agent** Listed ${children.length} sub-agent(s)`, result: lines.join("\n") };
  },
} satisfies TokenRingToolDefinition<typeof listSchema>;

const stopSchema = z.object({
  name: z.string().describe("The sub-agent's name, from agent_start"),
});

const agentStop = {
  name: "agent_stop",
  displayName: "Sub-agents/Stop",
  description: "Stop one of your sub-agents and close it, once you no longer need it. Sending it a message later resumes it from where it left off.",
  inputSchema: stopSchema,
  execute: async ({ name }: z.output<typeof stopSchema>, agent: Agent): Promise<TokenRingToolResult> => {
    const stopped = guard("agent_stop", () => agent.requireService(SubAgentService).stopSubAgent(agent, name));
    return { message: `**Sub-agent** Stopped ${name}`, result: stopped ? `Stopped ${name}.` : `${name} was already closed.` };
  },
} satisfies TokenRingToolDefinition<typeof stopSchema>;

export default [agentStart, agentSend, agentOutput, agentList, agentStop];
