// CRITICAL
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TSchema } from "@sinclair/typebox";
import type { AppContext } from "../../../types/context";
import { buildAgentFsTools } from "./tool-registry-agentfs";
import { createTextResult } from "./tool-registry-common";
import { buildDaytonaTools } from "./tool-registry-daytona";
import { buildPlanTools } from "./tool-registry-plan";
import type { AgentEventType } from "./contracts";
import { isDaytonaAgentModeEnabled } from "../../../services/daytona/toolbox-client";

export interface AgentToolRegistryOptions {
  sessionId: string;
  agentMode: boolean;
  agentFiles?: boolean;
  emitEvent?: (type: AgentEventType, data: Record<string, unknown>) => void;
}

/**
 * Build tools available to the agent for a session, based on enabled capabilities.
 * @param context - Application context.
 * @param options - Registry options.
 * @returns Agent tools.
 */
export const buildAgentTools = async (
  context: AppContext,
  options: AgentToolRegistryOptions
): Promise<AgentTool[]> => {
  const tools: AgentTool[] = [];
  const daytonaAgentMode = isDaytonaAgentModeEnabled(context.config);

  if (options.agentMode) {
    tools.push(...buildPlanTools(context, options));
  }

  if (options.agentMode && daytonaAgentMode) {
    tools.push(...buildDaytonaTools(context, options));
  }

  if ((options.agentMode || options.agentFiles) && daytonaAgentMode) {
    tools.push(...buildAgentFsTools(context, options));
  }

  // Always include a no-op tool for debugging.
  tools.push({
    name: "noop",
    label: "noop",
    description: "No-op tool for debugging.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
    } as unknown as TSchema,
    execute: async (_toolCallId, params): Promise<AgentToolResult<Record<string, unknown>>> => {
      const raw = params as Record<string, unknown>;
      const message = typeof raw["message"] === "string" ? raw["message"] : "noop";
      return createTextResult(message, { message });
    },
  });

  return tools;
};
