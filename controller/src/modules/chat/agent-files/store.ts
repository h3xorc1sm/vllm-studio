// CRITICAL
import type { AppContext } from "../../../types/context";
import {
  getDaytonaToolboxClient,
  isDaytonaAgentModeEnabled,
} from "../../../services/daytona/toolbox-client";
import { DaytonaAgentFsApi } from "./daytona-agentfs";
import type { AgentFsApi } from "./types";

const daytonaFsCache = new Map<string, DaytonaAgentFsApi>();

export const getSessionFsApi = async (
  context: AppContext,
  sessionId: string
): Promise<{ fs: AgentFsApi }> => {
  if (!isDaytonaAgentModeEnabled(context.config)) {
    throw new Error("Daytona agent mode is required for agent filesystem access");
  }

  const cached = daytonaFsCache.get(sessionId);
  if (cached) {
    return { fs: cached };
  }

  const client = getDaytonaToolboxClient(context.config);
  const fs = new DaytonaAgentFsApi(client, sessionId);
  daytonaFsCache.set(sessionId, fs);
  return { fs };
};
