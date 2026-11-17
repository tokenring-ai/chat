import type Agent from "@tokenring-ai/agent/Agent";
import ChatService, { type CheckToolApprovalOptions } from "../ChatService.ts";
import { ToolCallError } from "./tokenRingTool.ts";

/**
 * Asks for approval of a tool action under the agent's approval policy (see {@link ChatService.checkToolApproval}
 * and the tool approval standard in `ApprovalLevel`), and throws a ToolCallError the model can read when the
 * action is not approved. Call it right before the action, after the input has been checked.
 */
export async function requireToolApproval(agent: Agent, options: CheckToolApprovalOptions & { toolName: string }): Promise<void> {
  const approved = await agent.requireService(ChatService).checkToolApproval(options, agent);
  if (!approved) throw new ToolCallError(options.toolName, `The user did not approve this action: ${options.message}`);
}
