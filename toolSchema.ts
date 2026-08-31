import { InstallSourceSchema, SubAgentConfigSchema } from "@tokenring-ai/agent/schema";
import { z } from "zod";

/**
 * Agent-tool schemas, split out of `../schema.ts` so `rpc/schema.ts` can reach them without dragging
 * the server-side chat schema (and the AI client it pulls in) into the frontend bundle. `../schema.ts`
 * re-exports everything here, so importers can keep using either path.
 */

export const ChatToolInputArgumentSchema = z.object({
  description: z.string(),
  defaultValue: z.string().exactOptional(),
});

export const ChatToolConfigSchema = z.object({
  /** Type of agent used to execute the tool */
  agentType: z.string(),
  /** Tool Display Name */
  displayName: z.string(),
  /** Tool Description */
  description: z.string(),
  /** Group this tool appears under in pickers and the marketplace */
  category: z.string().default("User-Created Tools"),
  /** Tool Input Schema */
  inputArguments: z.record(z.string(), ChatToolInputArgumentSchema),
  /** The steps to execute */
  steps: z.array(z.string()).min(1),
  /** The subagent configuration */
  subAgent: SubAgentConfigSchema.prefault({}),
});

export type ChatToolConfig = z.infer<typeof ChatToolConfigSchema>;

/**
 * The contents of a single tool YAML file in the tool directory. The tool name comes from the file
 * name, so it is not part of the file body.
 *
 * Loose for the same reason {@link import("@tokenring-ai/agent/schema").AgentItemSchema} is: unknown
 * keys have to survive the round trip through disk rather than being silently dropped on save.
 */
export const ToolItemSchema = ChatToolConfigSchema.extend({
  installedFrom: InstallSourceSchema.exactOptional(),
}).loose();

export type ToolItem = z.output<typeof ToolItemSchema>;
export type ToolItemInput = z.input<typeof ToolItemSchema>;

/** A tool as read from the tool directory: the file body plus its name and last-modified time. */
export const ToolDefinitionSchema = ToolItemSchema.extend({
  name: z.string(),
  updatedAt: z.string(),
});

export type ToolDefinition = z.output<typeof ToolDefinitionSchema>;
