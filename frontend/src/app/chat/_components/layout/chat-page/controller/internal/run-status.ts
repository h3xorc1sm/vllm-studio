// CRITICAL
"use client";

import type { ChatMessage, ChatMessagePart, ToolResult } from "@/lib/types";

const MAX_STATUS_CHARS = 120;
const PHRASE_CYCLE_SECONDS = 2;

export const THINKING_PHRASES = [
  "Cooking up the cleanest answer...",
  "Bumbling around edge cases...",
  "Connecting the dots...",
  "Vibe-checking the final plan...",
  "Sharpening the response...",
] as const;

type ToolPart = Extract<ChatMessagePart, { toolCallId: string }>;

interface ActiveToolCall {
  toolCallId: string;
  toolName: string;
  target?: string;
}

function toSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateStatus(value: string): string {
  const single = toSingleLine(value);
  if (single.length <= MAX_STATUS_CHARS) return single;
  return `${single.slice(0, MAX_STATUS_CHARS).trim()}...`;
}

function formatDuration(secondsRaw: number): string {
  const seconds = Math.max(0, Math.floor(secondsRaw));
  const mm = Math.floor(seconds / 60);
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatToolDisplayName(toolName: string): string {
  const cleanName = toolName.includes("__") ? toolName.split("__").slice(1).join("__") : toolName;
  return cleanName.replace(/_/g, " ").replace(/\s+/g, " ").trim() || "tool";
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function extractFromRecord(record: Record<string, unknown>): string | undefined {
  const keys = [
    "url",
    "href",
    "link",
    "website",
    "uri",
    "query",
    "search",
    "q",
    "term",
    "path",
    "filePath",
    "filename",
    "file",
    "target",
    "name",
    "command",
    "cmd",
    "input",
    "text",
  ];

  for (const key of keys) {
    const direct = asString(record[key]);
    if (direct) return direct;

    const nested = record[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const nestedText = extractFromRecord(nested as Record<string, unknown>);
      if (nestedText) return nestedText;
    }
  }
  return undefined;
}

function extractToolTarget(input: unknown): string | undefined {
  if (input == null) return undefined;
  if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
    return String(input).trim() || undefined;
  }
  if (Array.isArray(input)) {
    for (const entry of input) {
      const candidate = extractToolTarget(entry);
      if (candidate) return candidate;
    }
    return undefined;
  }
  if (typeof input === "object") {
    return extractFromRecord(input as Record<string, unknown>);
  }
  return undefined;
}

function getToolPartToolName(part: ToolPart, toolResultsMap: Map<string, ToolResult>): string {
  const nameFromPart =
    typeof part.toolName === "string" && part.toolName.trim().length > 0
      ? part.toolName.trim()
      : undefined;
  const nameFromResult = toolResultsMap.get(part.toolCallId)?.name?.trim();
  return nameFromPart || nameFromResult || part.toolCallId;
}

function isToolPart(part: ChatMessagePart): part is ToolPart {
  return (
    typeof part === "object" &&
    part != null &&
    "toolCallId" in part &&
    typeof (part as { toolCallId?: unknown }).toolCallId === "string"
  );
}

function findActiveToolCall(
  messages: ChatMessage[],
  executingTools: Set<string>,
  toolResultsMap: Map<string, ToolResult>,
): ActiveToolCall | null {
  if (executingTools.size === 0) return null;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    for (let j = message.parts.length - 1; j >= 0; j -= 1) {
      const part = message.parts[j];
      if (!isToolPart(part)) continue;
      if (!executingTools.has(part.toolCallId)) continue;
      return {
        toolCallId: part.toolCallId,
        toolName: getToolPartToolName(part, toolResultsMap),
        target: extractToolTarget(part.input),
      };
    }
  }

  const [toolCallId] = Array.from(executingTools);
  return { toolCallId, toolName: toolCallId, target: undefined };
}

function toolActionLabel(toolName: string): string {
  const normalized = toolName.toLowerCase();

  if (
    normalized.includes("search") ||
    normalized.includes("query") ||
    normalized.includes("lookup") ||
    normalized.includes("find")
  ) {
    return "searched website";
  }

  if (
    normalized.includes("fetch") ||
    normalized.includes("browse") ||
    normalized.includes("scrape") ||
    normalized.includes("crawl") ||
    normalized.includes("open_url") ||
    normalized.includes("http")
  ) {
    return "fetched website";
  }

  const referencesFile = normalized.includes("file") || normalized.includes("path");
  if (referencesFile && (normalized.includes("create") || normalized.includes("write") || normalized.includes("save"))) {
    return "created file";
  }
  if (referencesFile && (normalized.includes("move") || normalized.includes("rename"))) {
    return "moved file";
  }
  if (referencesFile && (normalized.includes("delete") || normalized.includes("remove"))) {
    return "deleted file";
  }
  if (referencesFile && (normalized.includes("read") || normalized.includes("open"))) {
    return "opened file";
  }
  if (normalized.includes("command") || normalized.includes("shell") || normalized.includes("exec")) {
    return "ran command";
  }

  return `running ${formatToolDisplayName(toolName)}`;
}

function formatToolCallStatus(toolCall: ActiveToolCall): string {
  const action = toolActionLabel(toolCall.toolName);
  if (toolCall.target) {
    return truncateStatus(`${action}: ${toolCall.target}`);
  }
  if (action.startsWith("running ")) {
    return truncateStatus(action);
  }
  return truncateStatus(`${action}: ${formatToolDisplayName(toolCall.toolName)}`);
}

export function pickThinkingPhrase(elapsedSeconds: number): string {
  const index = Math.floor(Math.max(0, elapsedSeconds) / PHRASE_CYCLE_SECONDS) % THINKING_PHRASES.length;
  return THINKING_PHRASES[index];
}

export interface BuildRunStatusTextArgs {
  isLoading: boolean;
  streamStalled: boolean;
  elapsedSeconds: number;
  executingTools: Set<string>;
  toolResultsMap: Map<string, ToolResult>;
  messages: ChatMessage[];
}

export function buildRunStatusText({
  isLoading,
  streamStalled,
  elapsedSeconds,
  executingTools,
  toolResultsMap,
  messages,
}: BuildRunStatusTextArgs): string {
  if (!isLoading) return "";

  const activeToolCall = findActiveToolCall(messages, executingTools, toolResultsMap);
  if (activeToolCall) {
    return formatToolCallStatus(activeToolCall);
  }

  if (streamStalled) {
    return `Still cooking... quiet for ${formatDuration(elapsedSeconds)}`;
  }

  return pickThinkingPhrase(elapsedSeconds);
}
