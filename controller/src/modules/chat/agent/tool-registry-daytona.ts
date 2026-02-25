// CRITICAL
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TSchema } from "@sinclair/typebox";
import type { AppContext } from "../../../types/context";
import {
  getDaytonaToolboxClient,
  isDaytonaAgentModeEnabled,
} from "../../../services/daytona/toolbox-client";
import { AGENT_TOOL_NAMES } from "./contracts";
import { createTextResult } from "./tool-registry-common";
import type { AgentToolRegistryOptions } from "./tool-registry";

export const buildDaytonaTools = (
  context: AppContext,
  options: AgentToolRegistryOptions
): AgentTool[] => {
  if (!isDaytonaAgentModeEnabled(context.config)) {
    return [];
  }

  const client = getDaytonaToolboxClient(context.config);

  const executeCommand: AgentTool = {
    name: AGENT_TOOL_NAMES.EXECUTE_COMMAND,
    label: AGENT_TOOL_NAMES.EXECUTE_COMMAND,
    description: "Execute a shell command in the Daytona workspace for this chat session.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string" },
        cwd: { type: "string" },
        timeout: { type: "number" },
      },
      required: ["command"],
    } as unknown as TSchema,
    execute: async (_toolCallId, params): Promise<AgentToolResult<Record<string, unknown>>> => {
      const raw = params as Record<string, unknown>;
      const command = typeof raw["command"] === "string" ? raw["command"].trim() : "";
      if (!command) {
        throw new Error("command is required");
      }

      const cwd = typeof raw["cwd"] === "string" ? raw["cwd"].trim() : undefined;
      const timeout = typeof raw["timeout"] === "number" ? raw["timeout"] : undefined;

      const result = await client.executeCommand(options.sessionId, command, {
        ...(cwd ? { cwd } : {}),
        ...(typeof timeout === "number" && Number.isFinite(timeout) ? { timeout } : {}),
      });

      return createTextResult(result.result, {
        exitCode: result.exitCode,
        raw: result.raw,
      });
    },
  };

  return [executeCommand];
};
