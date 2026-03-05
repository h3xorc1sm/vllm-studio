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

const asRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // Fall through to command string fallback.
      }
    }
    return { command: trimmed };
  }
  return {};
};

const readStringArgument = (params: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = params[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return undefined;
};

const readPositiveNumberArgument = (
  params: Record<string, unknown>,
  keys: string[]
): number | undefined => {
  for (const key of keys) {
    const value = params[key];
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseFloat(value.trim())
          : Number.NaN;
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }
  return undefined;
};

const COMMAND_TOOL_PARAMETERS = {
  type: "object",
  properties: {
    command: { type: "string" },
    cmd: { type: "string" },
    cwd: { type: "string" },
    workdir: { type: "string" },
    timeout: { type: "number" },
    timeout_ms: { type: "number" },
  },
  anyOf: [{ required: ["command"] }, { required: ["cmd"] }],
} as unknown as TSchema;

const shellQuote = (value: string): string => `'${value.replace(/'/g, `'\"'\"'`)}'`;

const truncateText = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n...[truncated]`;
};

const parseCommandPayload = (
  raw: Record<string, unknown>
): { command: string; cwd?: string; timeout?: number } => {
  const command = readStringArgument(raw, ["command", "cmd", "shell_command", "shellCommand"]) ?? "";
  if (!command) {
    throw new Error("command (or cmd) is required");
  }

  const cwd = readStringArgument(raw, [
    "cwd",
    "workdir",
    "working_directory",
    "workingDirectory",
    "directory",
  ]);
  const timeoutSeconds = readPositiveNumberArgument(raw, ["timeout", "timeout_seconds", "timeoutSeconds"]);
  const timeoutMs = readPositiveNumberArgument(raw, ["timeout_ms", "timeoutMs"]);
  const timeout =
    timeoutSeconds ?? (timeoutMs !== undefined ? Math.max(1, Math.ceil(timeoutMs / 1000)) : undefined);

  return {
    command,
    ...(cwd ? { cwd } : {}),
    ...(typeof timeout === "number" && Number.isFinite(timeout) ? { timeout } : {}),
  };
};

const buildBrowserProbeCommand = (url: string): string =>
  [
    "set -euo pipefail",
    "if ! command -v curl >/dev/null 2>&1; then echo 'curl is required on the backend machine'; exit 127; fi",
    `URL=${shellQuote(url)}`,
    "tmp=$(mktemp)",
    "cleanup(){ rm -f \"$tmp\"; }",
    "trap cleanup EXIT",
    "curl -L --max-time 25 -A 'vllm-studio-agent-browser/1.0' -sL \"$URL\" > \"$tmp\"",
    "title=$(tr '\\n' ' ' < \"$tmp\" | sed -n \"s:.*<title[^>]*>\\(.*\\)</title>.*:\\1:Ip\" | head -n 1 | sed 's/[[:space:]]\\+/ /g; s/^ //; s/ $//')",
    "if [ -z \"$title\" ]; then title='(no title found)'; fi",
    "preview=$(head -c 1400 \"$tmp\" | tr '\\n' ' ' | tr '\\r' ' ' | sed 's/[[:space:]]\\+/ /g; s/^ //; s/ $//')",
    "printf 'URL: %s\\nTitle: %s\\nPreview: %s\\n' \"$URL\" \"$title\" \"$preview\"",
  ].join("\n");

export const buildDaytonaTools = (
  context: AppContext,
  options: AgentToolRegistryOptions
): AgentTool[] => {
  if (!isDaytonaAgentModeEnabled(context.config)) {
    return [];
  }

  const client = getDaytonaToolboxClient(context.config);

  const runCommandTool = async (
    params: unknown
  ): Promise<AgentToolResult<Record<string, unknown>>> => {
    const raw = asRecord(params);
    const payload = parseCommandPayload(raw);
    const result = await client.executeCommand(options.sessionId, payload.command, {
      ...(payload.cwd ? { cwd: payload.cwd } : {}),
      ...(typeof payload.timeout === "number" ? { timeout: payload.timeout } : {}),
    });

    return createTextResult(result.result, {
      exitCode: result.exitCode,
      raw: result.raw,
    });
  };

  const executeCommand: AgentTool = {
    name: AGENT_TOOL_NAMES.EXECUTE_COMMAND,
    label: AGENT_TOOL_NAMES.EXECUTE_COMMAND,
    description: "Execute a shell command in the Daytona workspace for this chat session.",
    parameters: COMMAND_TOOL_PARAMETERS,
    execute: async (_toolCallId, params) => runCommandTool(params),
  };

  const computerUse: AgentTool = {
    name: AGENT_TOOL_NAMES.COMPUTER_USE,
    label: AGENT_TOOL_NAMES.COMPUTER_USE,
    description:
      "Use the backend machine shell directly. Accepts the same payload as execute_command.",
    parameters: COMMAND_TOOL_PARAMETERS,
    execute: async (_toolCallId, params) => runCommandTool(params),
  };

  const browserOpenUrl: AgentTool = {
    name: AGENT_TOOL_NAMES.BROWSER_OPEN_URL,
    label: AGENT_TOOL_NAMES.BROWSER_OPEN_URL,
    description:
      "Open and inspect a URL from the backend machine. Returns page title and preview text.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string" },
        href: { type: "string" },
        link: { type: "string" },
        uri: { type: "string" },
        website: { type: "string" },
        timeout: { type: "number" },
        timeout_ms: { type: "number" },
      },
      anyOf: [
        { required: ["url"] },
        { required: ["href"] },
        { required: ["link"] },
        { required: ["uri"] },
        { required: ["website"] },
      ],
    } as unknown as TSchema,
    execute: async (_toolCallId, params): Promise<AgentToolResult<Record<string, unknown>>> => {
      const raw = asRecord(params);
      const url =
        readStringArgument(raw, [
          "url",
          "href",
          "link",
          "uri",
          "website",
          "target",
          "input",
          "command",
        ]) ?? "";
      if (!url) {
        throw new Error("url (or href/link/uri/website) is required");
      }

      const timeoutSeconds = readPositiveNumberArgument(raw, ["timeout", "timeout_seconds", "timeoutSeconds"]);
      const timeoutMs = readPositiveNumberArgument(raw, ["timeout_ms", "timeoutMs"]);
      const timeout =
        timeoutSeconds ?? (timeoutMs !== undefined ? Math.max(1, Math.ceil(timeoutMs / 1000)) : 35);

      const probeCommand = buildBrowserProbeCommand(url);
      const result = await client.executeCommand(options.sessionId, probeCommand, {
        timeout,
      });
      const text = truncateText(result.result, 8000);

      return createTextResult(text, {
        url,
        exitCode: result.exitCode,
        raw: result.raw,
      });
    },
  };

  return [executeCommand, computerUse, browserOpenUrl];
};
