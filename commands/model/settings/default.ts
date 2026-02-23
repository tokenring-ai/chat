import Agent from "@tokenring-ai/agent/Agent";
import show from "./show.ts";

export default async function defaultAction(remainder: string, agent: Agent): Promise<string> {
  return await show(remainder, agent);
}
