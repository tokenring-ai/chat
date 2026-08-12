import type Agent from "@tokenring-ai/agent/Agent";
import { z } from "zod";
import type { TokenRingToolDefinition, TokenRingToolResult } from "../schema.ts";

const name = "sleep";
const displayName = "Agent/Sleep";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MAX_SLEEP_SECONDS = 3600; // 1 hour

export async function execute({ seconds }: z.output<typeof inputSchema>, _agent: Agent): Promise<TokenRingToolResult> {
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));

  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    message: `**Slept** ${seconds}s`,
    result: `
Slept for ${seconds} seconds.
Current Date: ${now.toLocaleDateString("en-US")}
Current Time: ${now.toLocaleTimeString("en-US")}
Day of Week: ${DAYS[now.getDay()]}
Timezone: ${timezone}
  `,
  };
}

const description =
  "Sleeps for a specified number of seconds, then returns the current date and time.\n" +
  "Useful for introducing delays in agent workflows or waiting before performing actions.";

const inputSchema = z.object({
  seconds: z.number().int().positive().max(MAX_SLEEP_SECONDS).describe("The number of seconds to sleep (must be a positive integer, max 1 hour)."),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
