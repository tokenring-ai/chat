import { describe, expect, it } from "bun:test";
import createTestingAgent from "@tokenring-ai/agent/test/createTestingAgent.test";
import { ChatModelRegistry } from "@tokenring-ai/ai-client/ModelRegistry";
import createTestingApp from "@tokenring-ai/app/test/createTestingApp.test";
import createLocalRPCClient from "@tokenring-ai/rpc/createLocalRPCClient";
import { z } from "zod";
import ChatService from "../ChatService.ts";
import PermissionService, { MemoryPermissionStore } from "../PermissionService.ts";
import { ChatConfigMergedSchema } from "../schema.ts";
import { ChatServiceState } from "../state/chatServiceState.ts";
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

describe("Chat RPC model selection", () => {
  function setup() {
    const app = createTestingApp();
    const registry = app.addService(ChatModelRegistry, new ChatModelRegistry());
    registry.registerAllModelSpecs([
      {
        modelId: "known-model",
        providerDisplayName: "test",
        inputCapabilities: [],
        impl: {} as never,
        maxContextLength: 1000,
        costPerMillionInputTokens: 0,
        costPerMillionOutputTokens: 0,
      },
    ]);
    // Spawned before ChatService is added, so its state slice is set up here rather than by attach().
    const agent = createTestingAgent(app);
    agent.initializeState(ChatServiceState, ChatConfigMergedSchema.parse({ systemPrompt: "" }));
    const chatService = app.addService(ChatService, new ChatService(app));
    const client = createLocalRPCClient<typeof ChatRpcSchema>(chatRpc, app);
    return { agent, chatService, client };
  }

  it("rejects an unknown model without storing it", async () => {
    const { agent, chatService, client } = setup();
    chatService.setModel("test:known-model", agent);

    expect(await client.setModel({ agentId: agent.id, model: "test:no-such-model" })).toEqual({ status: "modelNotFound" });
    expect(chatService.getModel(agent)).toBe("test:known-model");
  });

  it("accepts a registered model", async () => {
    const { agent, chatService, client } = setup();
    expect(await client.setModel({ agentId: agent.id, model: "test:known-model" })).toEqual({ status: "success", success: true });
    expect(chatService.getModel(agent)).toBe("test:known-model");
    expect(await client.getModel({ agentId: agent.id })).toMatchObject({ status: "success", model: "test:known-model" });
  });

  it("reports an unknown model that is already stored as modelNotFound instead of throwing", async () => {
    const { agent, chatService, client } = setup();
    // Stored by an older build that did not validate.
    chatService.updateChatConfig({ model: "test:gone-model" }, agent);

    expect(await client.getModel({ agentId: agent.id })).toEqual({ status: "modelNotFound" });
    const controller = new AbortController();
    const stream = client.streamModel({ agentId: agent.id }, controller.signal);
    const first = await stream.next();
    controller.abort();
    expect(first.value).toEqual({ status: "modelNotFound" });
  });
});

describe("Chat RPC permission grants", () => {
  function setup() {
    const app = createTestingApp();
    const store = new MemoryPermissionStore();
    const permissions = app.addService(PermissionService, new PermissionService(app, store));
    const client = createLocalRPCClient<typeof ChatRpcSchema>(chatRpc, app);
    return { permissions, store, client };
  }

  it("grants an exact id, lists it and revokes it", async () => {
    const { client } = setup();
    const granted = await client.grantPermission({ id: "blog.mysite.publish", summary: "Publish posts on mysite" });
    expect(granted).toMatchObject({ status: "success", grant: { id: "blog.mysite.publish", summary: "Publish posts on mysite", source: "global", uses: 0 } });

    const listed = await client.listPermissionGrants({});
    expect(listed).toMatchObject({ status: "success", maxGrantLevel: 8 });
    expect(listed.grants.map(grant => grant.id)).toEqual(["blog.mysite.publish"]);

    expect(await client.revokePermissionGrant({ id: "blog.mysite.publish" })).toEqual({ status: "success", id: "blog.mysite.publish" });
    expect(await client.revokePermissionGrant({ id: "blog.mysite.publish" })).toEqual({ status: "notFound" });
    expect((await client.listPermissionGrants({})).grants).toEqual([]);
  });

  it("rejects wildcards and malformed ids", async () => {
    const { client, store } = setup();
    for (const id of ["blog.*.publish", "x.**", "Not Valid", ""]) {
      expect(await client.grantPermission({ id })).toMatchObject({ status: "rejected" });
    }
    expect(store.scopes.global).toEqual([]);
  });

  it("streams the current grants, then every change", async () => {
    const { client, permissions } = setup();
    const controller = new AbortController();
    const stream = client.streamPermissionGrants({}, controller.signal);
    expect((await stream.next()).value).toMatchObject({ status: "success", grants: [] });
    const next = stream.next();
    await permissions.grant({ id: "x.acct.post" });
    const update = (await next).value as { grants: { id: string }[] };
    expect(update.grants.map(grant => grant.id)).toEqual(["x.acct.post"]);
    controller.abort();
    await stream.return(undefined);
  });
});
