// CRITICAL
import type { AppContext } from "../../../types/context";
import { getAgentFs } from "./store";
import {
  buildAgentFileTree,
  mkdirp,
  normalizeAgentPath,
  toFsPath,
} from "./helpers";
import type { AgentFsApi, AgentFileEntry } from "./types";

export const getSessionAgentFs = async (
  context: AppContext,
  sessionId: string
): Promise<AgentFsApi> => {
  const agent = await getAgentFs(context, sessionId);
  return agent.fs as AgentFsApi;
};

export const listAgentFiles = async (
  context: AppContext,
  sessionId: string,
  rawPath: string,
  recursive: boolean
): Promise<AgentFileEntry[]> => {
  const fs = await getSessionAgentFs(context, sessionId);
  const normalized = normalizeAgentPath(rawPath);
  return buildAgentFileTree(fs, normalized, recursive);
};

export const readAgentFile = async (
  context: AppContext,
  sessionId: string,
  rawPath: string
): Promise<{ normalizedPath: string; content: string }> => {
  const fs = await getSessionAgentFs(context, sessionId);
  const normalized = normalizeAgentPath(rawPath);
  const content = await fs.readFile(toFsPath(normalized), "utf8");
  return { normalizedPath: normalized, content };
};

export const writeAgentFile = async (
  context: AppContext,
  sessionId: string,
  rawPath: string,
  content: string | Buffer
): Promise<{ normalizedPath: string; bytes: number }> => {
  const fs = await getSessionAgentFs(context, sessionId);
  const normalized = normalizeAgentPath(rawPath);
  const parentDirectory = normalized.includes("/")
    ? normalized.slice(0, normalized.lastIndexOf("/"))
    : "";
  if (parentDirectory) {
    await mkdirp(fs, parentDirectory);
  }
  await fs.writeFile(toFsPath(normalized), content);
  return {
    normalizedPath: normalized,
    bytes: typeof content === "string" ? Buffer.byteLength(content, "utf8") : content.length,
  };
};

export const deleteAgentPath = async (
  context: AppContext,
  sessionId: string,
  rawPath: string
): Promise<string> => {
  const fs = await getSessionAgentFs(context, sessionId);
  const normalized = normalizeAgentPath(rawPath);
  await fs.rm(toFsPath(normalized), { recursive: true, force: true });
  return normalized;
};

export const createAgentDirectory = async (
  context: AppContext,
  sessionId: string,
  rawPath: string
): Promise<string> => {
  const fs = await getSessionAgentFs(context, sessionId);
  const normalized = normalizeAgentPath(rawPath);
  await mkdirp(fs, normalized);
  return normalized;
};

export const moveAgentPath = async (
  context: AppContext,
  sessionId: string,
  rawFrom: string,
  rawTo: string
): Promise<{ from: string; to: string }> => {
  const fs = await getSessionAgentFs(context, sessionId);
  const from = normalizeAgentPath(rawFrom);
  const to = normalizeAgentPath(rawTo);
  const targetDirectory = to.includes("/") ? to.slice(0, to.lastIndexOf("/")) : "";
  if (targetDirectory) {
    await mkdirp(fs, targetDirectory);
  }
  await fs.rename(toFsPath(from), toFsPath(to));
  return { from, to };
};
