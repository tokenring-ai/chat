import type Agent from "@tokenring-ai/agent/Agent";
import {ChatInputMessage} from "@tokenring-ai/ai-client/client/AIChatClient";
import {ChatService} from "../index.ts";
import {ChatConfig} from "../schema.ts";
import z from "zod";

const toolCallParamsSchema = z.object({
  role: z.enum(["system", "user"]),
  header: z.string(),
  toolName: z.string(),
  toolInput: z.record(z.string(), z.any()),
})

export default async function * getContextItems(input: string, chatConfig: ChatConfig, params: any, agent: Agent): AsyncGenerator<ChatInputMessage> {
  const validatedParams = toolCallParamsSchema.parse(params);

  const chatService = agent.requireServiceByType(ChatService);
  const {toolDefinition} = chatService.requireTool(validatedParams.toolName);

  if (! toolDefinition) throw new Error(`Tool ${validatedParams.toolName} is not a native TokenRing tool, and cannot be injected into the chat context.`);

  const { inputSchema, execute } = toolDefinition;

  const result = await execute(inputSchema.parse(validatedParams.toolInput), agent);

  yield {
    role: validatedParams.role,
    content: `
${validatedParams.header}

${typeof (result) === "string" ? result : JSON.stringify(result, null, 2)}
`.trim()
  };
}