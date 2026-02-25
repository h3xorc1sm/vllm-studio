// CRITICAL
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { AgentFS } from "agentfs-sdk";
import type { AppContext } from "../../../types/context";
import {
  getDaytonaToolboxClient,
  isDaytonaAgentModeEnabled,
} from "../../../services/daytona/toolbox-client";
import { DaytonaAgentFsApi } from "./daytona-agentfs";
import type { AgentFsApi } from "./types";

const agentFsCache = new Map<string, Promise<AgentFS>>();
const daytonaFsCache = new Map<string, DaytonaAgentFsApi>();

const ensureAgentFsRoot = (context: AppContext): string => {
  const root = resolve(context.config.data_dir, "agentfs");
  mkdirSync(root, { recursive: true });
  return root;
};

export const getAgentFs = (context: AppContext, sessionId: string): Promise<AgentFS> => {
  const root = ensureAgentFsRoot(context);
  const dbPath = resolve(root, `${sessionId}.db`);
  const cached = agentFsCache.get(dbPath);
  if (cached) return cached;

  const opened = AgentFS.open({ id: sessionId, path: dbPath }).catch((error) => {
    agentFsCache.delete(dbPath);
    throw error;
  });
  agentFsCache.set(dbPath, opened);
  return opened;
};

export const getSessionFsApi = async (
  context: AppContext,
  sessionId: string
): Promise<{ fs: AgentFsApi }> => {
  if (isDaytonaAgentModeEnabled(context.config)) {
    const cached = daytonaFsCache.get(sessionId);
    if (cached) {
      return { fs: cached };
    }
    const client = getDaytonaToolboxClient(context.config);
    const fs = new DaytonaAgentFsApi(client, sessionId);
    daytonaFsCache.set(sessionId, fs);
    return { fs };
  }

  const local = await getAgentFs(context, sessionId);
  return { fs: local.fs as AgentFsApi };
};
