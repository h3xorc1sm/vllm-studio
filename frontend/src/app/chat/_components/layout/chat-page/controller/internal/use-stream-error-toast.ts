// CRITICAL
"use client";

import { useAppStore } from "@/store";

let lastPushedStreamErrorKey = "";

export function pushStreamErrorToast(
  streamError: string,
  opts: {
    activeRunId: string | null;
    lastEventTime: number;
  },
) {
  const state = useAppStore.getState();
  const sessionId = state.currentSessionId ?? "unknown-session";
  const model = state.selectedModel || "unknown-model";
  const elapsedSeconds = state.elapsedSeconds;
  const executingTools = state.executingTools;
  const runId = opts.activeRunId ?? "unknown-run";
  const dedupeKey = `stream-error:${sessionId}:${runId}:${streamError}`;

  if (lastPushedStreamErrorKey === dedupeKey) return;
  lastPushedStreamErrorKey = dedupeKey;

  const detail = [
    `session_id: ${sessionId}`,
    `run_id: ${runId}`,
    `model: ${model}`,
    `elapsed_s: ${elapsedSeconds}`,
    `executing_tools: ${Array.from(executingTools).join(", ") || "(none)"}`,
    `last_event_ms_ago: ${
      opts.lastEventTime > 0 ? String(Date.now() - opts.lastEventTime) : "(unknown)"
    }`,
  ].join("\n");

  state.pushToast({
    kind: "error",
    title: "Stream error",
    message: streamError,
    detail,
    dedupeKey,
  });
}
