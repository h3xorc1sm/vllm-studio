export interface AgentFileEntry {
  name: string;
  type: "file" | "dir";
  size?: number;
  children?: AgentFileEntry[];
}

export interface AgentFsDirStats {
  isDirectory: () => boolean;
  size: number;
}

export interface AgentFsDirEntry {
  name: string;
  stats: AgentFsDirStats;
}

export interface AgentFsApi {
  readdirPlus: (path: string) => Promise<AgentFsDirEntry[]>;
  mkdir: (path: string) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  stat: (path: string) => Promise<{ isDirectory: () => boolean }>;
  readFile: (path: string, encoding: string) => Promise<string>;
  writeFile: (path: string, data: string | Buffer) => Promise<void>;
  rm: (path: string, options: { recursive: boolean; force: boolean }) => Promise<void>;
}
