import { describe, expect, it, mock } from "bun:test";
import type Agent from "@tokenring-ai/agent/Agent";
import createTestingAgent from "@tokenring-ai/agent/test/createTestingAgent.test";
import type TokenRingApp from "@tokenring-ai/app";
import createTestingApp from "@tokenring-ai/app/test/createTestingApp.test";
import { shouldCompact, shouldContinuePastMaxSteps } from "./runChat.ts";

function agent(answer = true) {
  return { askForApproval: mock(async (_question: Parameters<Agent["askForApproval"]>[0]) => answer) };
}

/** A real agent whose questions nobody can answer (deadline 0). */
function unattendedAgent() {
  const real = createTestingAgent(createTestingApp() as TokenRingApp);
  real.answerTimeoutSeconds = 0;
  return real;
}

describe("shouldCompact", () => {
  it("asks under the ask policy, going ahead when the question goes unanswered", async () => {
    const yes = agent(true);
    expect(await shouldCompact("ask", yes)).toBe(true);
    expect(yes.askForApproval).toHaveBeenCalledTimes(1);
    expect(yes.askForApproval.mock.calls[0]![0].whenUnanswered).toBe(true);
    expect(await shouldCompact("ask", agent(false))).toBe(false);
  });

  it("compacts at once when nobody can answer", async () => {
    expect(await shouldCompact("ask", unattendedAgent())).toBe(true);
  });

  it("follows the automatic and never policies without asking", async () => {
    const interactive = agent();
    expect(await shouldCompact("automatic", interactive)).toBe(true);
    expect(await shouldCompact("never", interactive)).toBe(false);
    expect(interactive.askForApproval).not.toHaveBeenCalled();
  });
});

describe("shouldContinuePastMaxSteps", () => {
  it("keeps going only when the person says so", async () => {
    expect(await shouldContinuePastMaxSteps(agent(true), 31, 30)).toBe(true);
    expect(await shouldContinuePastMaxSteps(agent(false), 31, 30)).toBe(false);
  });

  it("stops at once when nobody can answer", async () => {
    expect(await shouldContinuePastMaxSteps(unattendedAgent(), 31, 30)).toBe(false);
  });
});
