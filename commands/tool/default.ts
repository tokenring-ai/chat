import Agent from "@tokenring-ai/agent/Agent";
import list from "./list.ts";
import select from "./select.ts";

export default async function defaultAction(_remainder: string, agent: Agent): Promise<void> {
  if (agent.headless) {
    await list("", agent);
  } else {
    await select("", agent);
  }
}
