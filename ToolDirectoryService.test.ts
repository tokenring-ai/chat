import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import createTestingApp from "@tokenring-ai/app/test/createTestingApp.test";
import ChatService from "./ChatService.ts";
import ToolDirectoryService from "./ToolDirectoryService.ts";
import type { ToolItemInput } from "./toolSchema.ts";

const codeReviewTool: ToolItemInput = {
  agentType: "code-reviewer",
  displayName: "Review Code",
  description: "Reviews a diff",
  inputArguments: { diff: { description: "The diff to review" } },
  steps: ["Review this diff:\n{{ diff }}"],
};

describe("ToolDirectoryService", () => {
  const tempDirs: string[] = [];

  function makeApp() {
    const app = createTestingApp();
    const chatService = app.addService(ChatService, new ChatService(app));

    const toolDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "tr-tool-dir-"));
    tempDirs.push(toolDirectory);
    const service = app.addService(ToolDirectoryService, new ToolDirectoryService(app));
    void service.reconfigure(toolDirectory);
    return { app, chatService, service, toolDirectory };
  }

  afterEach(() => {
    for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
    tempDirs.length = 0;
  });

  it("writes a tool to disk and registers it with ChatService", async () => {
    const { chatService, service, toolDirectory } = makeApp();

    const definition = await service.createToolDefinition("review_code", codeReviewTool);

    expect(definition.name).toBe("review_code");
    expect(definition.updatedAt).toBeString();
    // The category default lands on the file, so the marketplace and pickers always have a group.
    expect(definition.category).toBe("User-Created Tools");
    expect(fs.existsSync(path.join(toolDirectory, "review_code.yaml"))).toBe(true);
    expect(chatService.getAvailableToolNames()).toContain("review_code");
  });

  it("refuses to create over an existing tool and to update a missing one", async () => {
    const { service } = makeApp();
    await service.createToolDefinition("review_code", codeReviewTool);

    await expect(service.createToolDefinition("review_code", codeReviewTool)).rejects.toThrow('Tool "review_code" already exists');
    await expect(service.updateToolDefinition("nope", codeReviewTool)).rejects.toThrow('Tool "nope" not found');
  });

  it("rejects names that could escape the tool directory", async () => {
    const { service } = makeApp();
    await expect(service.createToolDefinition("../evil", codeReviewTool)).rejects.toThrow('Invalid tool name "../evil"');
  });

  it("round-trips installedFrom provenance through disk", async () => {
    const { service } = makeApp();
    const installedFrom = {
      registry: "test/registry",
      id: "tool/coding/review-code",
      version: "1.0.0",
      author: "TokenRing Core",
      installedAt: "2026-08-17T00:00:00.000Z",
    };

    await service.createToolDefinition("review_code", { ...codeReviewTool, installedFrom });

    const reread = await service.getToolDefinition("review_code");
    expect(reread?.installedFrom).toMatchObject({ registry: "test/registry", id: "tool/coding/review-code" });
  });

  it("unregisters the tool when its file is deleted", async () => {
    const { chatService, service } = makeApp();
    await service.createToolDefinition("review_code", codeReviewTool);

    expect(await service.deleteToolDefinition("review_code")).toBe(true);
    expect(chatService.getAvailableToolNames()).not.toContain("review_code");
    // A second delete is a miss, not a throw.
    expect(await service.deleteToolDefinition("review_code")).toBe(false);
  });

  it("skips unparseable files instead of hiding the rest of the directory", async () => {
    const { service, toolDirectory } = makeApp();
    await service.createToolDefinition("review_code", codeReviewTool);
    fs.writeFileSync(path.join(toolDirectory, "broken.yaml"), "displayName: missing everything else\n");

    expect((await service.listToolDefinitions()).map(tool => tool.name)).toEqual(["review_code"]);
  });

  it("lets a workspace tool win over a config tool of the same name", async () => {
    const { chatService, service } = makeApp();
    chatService.reconfigureTools({
      review_code: { ...codeReviewTool, displayName: "From config", category: "Config Tools", subAgent: {} } as never,
    });
    await service.createToolDefinition("review_code", { ...codeReviewTool, displayName: "From workspace" });

    expect(chatService.requireTool("review_code").toolDefinition?.displayName).toBe("From workspace");
  });
});
