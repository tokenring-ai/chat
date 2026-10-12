import { describe, expect, it } from "bun:test";
import createTestingApp from "@tokenring-ai/app/test/createTestingApp.test";
import createLocalRPCClient from "@tokenring-ai/rpc/createLocalRPCClient";
import { z } from "zod";
import ChatService from "../ChatService.ts";
import chatRpc from "./chat.ts";
import type ChatRpcSchema from "./schema.ts";

describe("Chat RPC getAvailableTools", () => {
  it("returns each tool's display name and description", async () => {
    const app = createTestingApp();
    const chatService = app.addService(ChatService, new ChatService(app));
    chatService.addTools([
      {
        name: "demo_echo",
        displayName: "demo/echo",
        description: "Echoes its input back",
        inputSchema: z.object({}),
        execute: () => ({ type: "text", text: "ok" }) as never,
      },
    ]);

    const client = createLocalRPCClient<typeof ChatRpcSchema>(chatRpc, app);
    const { tools } = await client.getAvailableTools({});
    expect(tools.demo_echo).toEqual({ displayName: "demo/echo", description: "Echoes its input back" });
  });
});
