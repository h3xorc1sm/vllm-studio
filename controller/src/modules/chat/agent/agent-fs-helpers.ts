import { posix } from "node:path";
import type { AgentFileEntry, AgentFsApi } from "./agent-fs-interfaces";

export const normalizeAgentPath = (rawPath: string): string => {
  const cleaned = rawPath.replace(/^\/+/, "").trim();
  if (!cleaned) return "";
  const normalized = posix.normalize(cleaned);
  if (normalized === "." || normalized === "") return "";
  if (normalized.startsWith("..") || normalized.includes("/..")) {
    throw new Error("Invalid path");
  }
  return normalized.replace(/^\/+/, "");
};

export const toFsPath = (relativePath: string): string => (relativePath ? `/${relativePath}` : "/");

export const buildAgentFileTree = async (
  fs: AgentFsApi,
  relativePath: string,
  recursive: boolean
): Promise<AgentFileEntry[]> => {
  const fsPath = toFsPath(relativePath);
  const entries = await fs.readdirPlus(fsPath);
  const mapped = await Promise.all(
    entries.map(async (entry) => {
      const isDirectory = entry.stats.isDirectory();
      const nextRelative = relativePath ? posix.join(relativePath, entry.name) : entry.name;
      if (isDirectory) {
        return {
          name: entry.name,
          type: "dir" as const,
          children: recursive ? await buildAgentFileTree(fs, nextRelative, recursive) : [],
        };
      }
      return {
        name: entry.name,
        type: "file" as const,
        size: entry.stats.size,
      };
    })
  );
  return mapped.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "dir" ? -1 : 1;
  });
};

export const mkdirp = async (fs: AgentFsApi, relativePath: string): Promise<void> => {
  const segments = relativePath.split("/").filter(Boolean);
  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    try {
      await fs.mkdir(toFsPath(current));
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code !== "EEXIST") throw error;
    }
  }
};
