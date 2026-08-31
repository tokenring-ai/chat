import fs from "node:fs/promises";
import path from "node:path";
import type TokenRingApp from "@tokenring-ai/app";
import writeYamlAtomic from "@tokenring-ai/app/config/writeYamlAtomic";
import type { TokenRingService } from "@tokenring-ai/app/types";
import formatError from "@tokenring-ai/utility/error/formatError";
import { YAML } from "bun";
import ChatService from "./ChatService.ts";
import { type ChatToolConfig, type ToolDefinition, type ToolItemInput, ToolItemSchema } from "./schema.ts";

const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const EXTENSION = ".yaml";

const FILE_HEADER = "# TokenRing tool definition. The file name is the tool name.";

function assertValidName(name: string): void {
  if (!NAME_PATTERN.test(name)) {
    throw new Error(`Invalid tool name "${name}". Names must start with a letter or number and may only contain letters, numbers, hyphens, and underscores.`);
  }
}

async function pathExists(target: string): Promise<boolean> {
  return fs
    .access(target)
    .then(() => true)
    .catch(() => false);
}

/**
 * Manages editable agent-backed tools stored as YAML files on disk, and keeps them registered with
 * {@link ChatService} as workspace tools.
 *
 * Layout: `<toolDirectory>/<toolName>.yaml`, one tool per file, the file body being the tool config
 * without its name (which comes from the file name).
 *
 * These sit alongside the tools that come from the configuration layers: config tools are read-only,
 * tools in this directory can be edited and deleted. This is the same arrangement
 * {@link import("@tokenring-ai/agent/AgentDirectoryService").default} gives agent types, and it is
 * what lets a tool be installed from a marketplace registry — a config-only tool has nowhere to land.
 */
export default class ToolDirectoryService implements TokenRingService {
  readonly name = "ToolDirectoryService";
  description = "Manages editable agent tools, backed by YAML files on disk";

  private toolDirectory = "tools";

  constructor(private app: TokenRingApp) {}

  async reconfigure(toolDirectory: string): Promise<void> {
    const previousDirectory = this.toolDirectory;
    this.toolDirectory = toolDirectory;
    // A directory change swaps the whole set of workspace tools.
    if (previousDirectory !== toolDirectory) {
      await this.syncToService();
    }
  }

  getToolDirectory(): string {
    return this.app.getWorkspaceResolvedPath(this.toolDirectory);
  }

  /**
   * Every valid tool definition in the tool directory, sorted by name. Files that fail to parse are
   * skipped so one bad file cannot hide the rest.
   */
  async listToolDefinitions(): Promise<ToolDefinition[]> {
    const root = this.getToolDirectory();
    let entries: string[];
    try {
      entries = await fs.readdir(root);
    } catch {
      return [];
    }

    const definitions: ToolDefinition[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(EXTENSION)) continue;
      const toolName = entry.slice(0, -EXTENSION.length);
      if (!NAME_PATTERN.test(toolName)) continue;
      try {
        const definition = await this.readToolFile(path.join(root, entry), toolName);
        if (definition) definitions.push(definition);
      } catch (error) {
        console.error(`Skipping invalid tool file ${entry}: ${formatError(error)}`);
      }
    }

    return definitions.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getToolDefinition(toolName: string): Promise<ToolDefinition | null> {
    return this.readToolFile(this.resolveToolPath(toolName), toolName);
  }

  async createToolDefinition(toolName: string, tool: ToolItemInput): Promise<ToolDefinition> {
    const filePath = this.resolveToolPath(toolName);
    if (await pathExists(filePath)) {
      throw new Error(`Tool "${toolName}" already exists`);
    }
    const definition = await this.writeToolFile(filePath, toolName, tool);
    await this.syncToService();
    return definition;
  }

  async updateToolDefinition(toolName: string, tool: ToolItemInput): Promise<ToolDefinition> {
    const filePath = this.resolveToolPath(toolName);
    if (!(await pathExists(filePath))) {
      throw new Error(`Tool "${toolName}" not found`);
    }
    const definition = await this.writeToolFile(filePath, toolName, tool);
    await this.syncToService();
    return definition;
  }

  async deleteToolDefinition(toolName: string): Promise<boolean> {
    const filePath = this.resolveToolPath(toolName);
    try {
      await fs.unlink(filePath);
    } catch {
      return false;
    }
    await this.syncToService();
    return true;
  }

  /**
   * Reads the whole directory and replaces the workspace tools registered with {@link ChatService}.
   * Safe to call before the service exists — tools are picked up by the next sync in that case.
   */
  async syncToService(): Promise<void> {
    const chatService = this.app.getService(ChatService);
    if (!chatService) return;

    const definitions = await this.listToolDefinitions();
    const tools: Record<string, ChatToolConfig> = {};
    for (const definition of definitions) {
      tools[definition.name] = toToolConfig(definition);
    }
    chatService.setWorkspaceToolConfigs(tools);
  }

  private resolveToolPath(toolName: string): string {
    assertValidName(toolName);
    return path.join(this.getToolDirectory(), `${toolName}${EXTENSION}`);
  }

  private async readToolFile(filePath: string, toolName: string): Promise<ToolDefinition | null> {
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(filePath);
    } catch {
      return null;
    }

    const parsed = YAML.parse(await fs.readFile(filePath, "utf-8"));
    const item = ToolItemSchema.parse(parsed ?? {});
    return { ...item, name: toolName, updatedAt: stat.mtime.toISOString() };
  }

  private async writeToolFile(filePath: string, toolName: string, tool: ToolItemInput): Promise<ToolDefinition> {
    const item = ToolItemSchema.parse(tool);
    writeYamlAtomic(filePath, item, FILE_HEADER);
    const stat = await fs.stat(filePath);
    return { ...item, name: toolName, updatedAt: stat.mtime.toISOString() };
  }
}

/** Drops the fields that describe the file rather than the tool. `installedFrom` rides along in the
 * loose remainder, the same way it does for agents, so provenance survives without a second read. */
function toToolConfig(definition: ToolDefinition): ChatToolConfig {
  const { name: _name, updatedAt: _updatedAt, ...config } = definition;
  return config as ChatToolConfig;
}
