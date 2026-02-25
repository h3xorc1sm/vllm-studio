import type { AgentFsApi, AgentFsDirEntry, AgentFsDirStats } from "./types";
import type { DaytonaToolboxClient } from "../../../services/daytona/toolbox-client";

const toRelativePath = (path: string): string => path.replace(/^\/+/, "").trim();

const buildStats = (isDirectory: boolean, size: number): AgentFsDirStats => ({
  isDirectory: () => isDirectory,
  size,
});

export class DaytonaAgentFsApi implements AgentFsApi {
  private readonly client: DaytonaToolboxClient;
  private readonly sessionId: string;

  public constructor(client: DaytonaToolboxClient, sessionId: string) {
    this.client = client;
    this.sessionId = sessionId;
  }

  public async readdirPlus(path: string): Promise<AgentFsDirEntry[]> {
    const entries = await this.client.listFiles(this.sessionId, toRelativePath(path));
    return entries.map((entry) => ({
      name: entry.name,
      stats: buildStats(entry.isDirectory, entry.size),
    }));
  }

  public async mkdir(path: string): Promise<void> {
    await this.client.createFolder(this.sessionId, toRelativePath(path));
  }

  public async rename(from: string, to: string): Promise<void> {
    await this.client.movePath(this.sessionId, toRelativePath(from), toRelativePath(to));
  }

  public async stat(path: string): Promise<{ isDirectory: () => boolean }> {
    if (!path || path === "/") {
      return { isDirectory: () => true };
    }
    const info = await this.client.getFileInfo(this.sessionId, toRelativePath(path));
    return {
      isDirectory: () => info.isDirectory,
    };
  }

  public async readFile(path: string, _encoding: string): Promise<string> {
    return this.client.readFile(this.sessionId, toRelativePath(path));
  }

  public async writeFile(path: string, data: string | Buffer): Promise<void> {
    await this.client.writeFile(this.sessionId, toRelativePath(path), data);
  }

  public async rm(path: string, options: { recursive: boolean; force: boolean }): Promise<void> {
    await this.client.deletePath(this.sessionId, toRelativePath(path), options);
  }
}
