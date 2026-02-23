import Agent from "@tokenring-ai/agent/Agent";
import list from "./list.ts";
import select from "./select.ts";

export default async function defaultAction(_remainder: string, agent: Agent): Promise<string> {
  if (agent.headless) {
    return await list("", agent);
  } else {
    return await select("", agent);
  }
}
