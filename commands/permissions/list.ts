import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import PermissionService from "../../PermissionService.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

function execute({ agent }: AgentCommandInputType<typeof inputSchema>): string {
  const service = agent.requireService(PermissionService);
  const grants = service.list();
  if (grants.length === 0) {
    return `No permissions are granted. Choose "Always allow" when an action asks for approval to create one.\nThe highest grantable level is ${service.maxGrantLevel}.`;
  }
  const lines = grants.map(grant => {
    const parts = [
      `granted ${grant.grantedAt}`,
      grant.lastUsedAt ? `last used ${grant.lastUsedAt}` : "never used",
      `${grant.uses} use${grant.uses === 1 ? "" : "s"}`,
      `from ${grant.source} config`,
    ];
    const summary = grant.summary ? ` — ${grant.summary}` : "";
    const ignored = grant.ignoredReason ? `\n  IGNORED: ${grant.ignoredReason}` : "";
    return `- \`${grant.id}\`${summary}\n  ${parts.join(", ")}${ignored}`;
  });
  return `Permissions (actions approved without asking):\n\n${lines.join("\n")}\n\nRevoke one with /permissions revoke <id>.`;
}

export default {
  name: "permissions list",
  description: "List the actions that are always allowed",
  alias: ["permissions"],
  inputSchema,
  execute,
  help: `List the permissions you granted with "Always allow", when each was last used and how often.

## Example

/permissions list`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
