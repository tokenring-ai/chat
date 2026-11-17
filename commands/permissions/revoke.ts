import { CommandFailedError } from "@tokenring-ai/agent/AgentError";
import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import PermissionService, { PermissionError } from "../../PermissionService.ts";

const inputSchema = {
  positionals: [{ name: "id", description: "The exact permission id, as shown by /permissions list", required: true }],
} as const satisfies AgentCommandInputSchema;

async function execute({ args: { id }, agent }: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const service = agent.requireService(PermissionService);
  try {
    const removed = await service.revoke(id.trim());
    if (!removed) throw new CommandFailedError(`There is no permission with the id "${id}". See /permissions list.`);
    return `Revoked \`${id.trim()}\`. Requests like it ask for approval again.`;
  } catch (error) {
    if (error instanceof CommandFailedError) throw error;
    if (error instanceof PermissionError) throw new CommandFailedError(error.message);
    throw new CommandFailedError(`Could not revoke the permission: ${Error.isError(error) ? error.message : String(error)}`, { cause: error });
  }
}

export default {
  name: "permissions revoke",
  description: "Stop always allowing an action",
  inputSchema,
  execute,
  help: `Remove a permission by its exact id. Wildcards are not expanded: pass the id exactly as /permissions list shows it.

## Example

/permissions revoke blog.mysite.publish`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
