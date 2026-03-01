// CRITICAL
"use client";

import { useCallback, useEffect } from "react";
import type { MutableRefObject } from "react";
import api, { type ChatRunStreamEvent } from "@/lib/api";
import type { ToolResult } from "@/lib/types";
import { pushStreamErrorToast } from "./controller/internal/use-stream-error-toast";

export interface ChatRunStreamPayload {
  content: string;
  message_id: string;
  model?: string;
  provider?: string;
  system?: string;
  agent_mode?: boolean;
  agent_files?: boolean;
  deep_research?: boolean;
  thinking_level?: string;
  images?: Array<{ data: string; mimeType: string; name?: string }>;
}

export interface UseChatRunStreamArgs {
  activeRunIdRef: MutableRefObject<string | null>;
  runAbortControllerRef: MutableRefObject<AbortController | null>;
  runCompletedRef: MutableRefObject<boolean>;
  lastEventTimeRef: MutableRefObject<number>;
  sessionIdRef: MutableRefObject<string | null>;
  setIsLoading: (value: boolean) => void;
  setStreamError: (value: string | null) => void;
  setStreamStalled: (value: boolean) => void;
  setExecutingTools: (value: Set<string>) => void;
  setToolResultsMap: (value: Map<string, ToolResult>) => void;
  handleRunEvent: (event: ChatRunStreamEvent) => void;
}

export function useChatRunStream({
  activeRunIdRef,
  runAbortControllerRef,
  runCompletedRef,
  lastEventTimeRef,
  sessionIdRef,
  setIsLoading,
  setStreamError,
  setStreamStalled,
  setExecutingTools,
  setToolResultsMap,
  handleRunEvent,
}: UseChatRunStreamArgs) {
  useEffect(() => {
    return () => {
      runAbortControllerRef.current?.abort();
      const runId = activeRunIdRef.current;
      const sessionId = sessionIdRef.current;
      if (runId && sessionId) {
        void api.abortChatRun(sessionId, runId).catch(() => {});
      }
      activeRunIdRef.current = null;
    };
  }, []);

  const startRunStream = useCallback(
    async (sessionId: string, payload: ChatRunStreamPayload) => {
      if (runAbortControllerRef.current) {
        runAbortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      runAbortControllerRef.current = abortController;
      runCompletedRef.current = false;
      lastEventTimeRef.current = Date.now();
      setIsLoading(true);
      setStreamError(null);
      setStreamStalled(false);
      setExecutingTools(new Set());
      setToolResultsMap(new Map<string, ToolResult>());

      let runIdForLifecycle: string | null = null;

      // Safety timeout: if no SSE event arrives for 120s, abort the stream
      // to prevent the UI from getting stuck forever on a hung connection.
      const STREAM_IDLE_TIMEOUT_MS = 120_000;
      let idleTimer: ReturnType<typeof setTimeout> | null = null;
      const resetIdleTimer = () => {
        if (idleTimer) clearTimeout(idleTimer);
        if (abortController.signal.aborted) return;
        idleTimer = setTimeout(() => {
          if (!abortController.signal.aborted && !runCompletedRef.current) {
            console.warn("[stream] Idle timeout reached — aborting hung stream");
            abortController.abort();
            const timeoutMsg = "Stream timed out (no events for 2 minutes)";
            setStreamError(timeoutMsg);
            pushStreamErrorToast(timeoutMsg, {
              activeRunId: activeRunIdRef.current,
              lastEventTime: lastEventTimeRef.current,
            });
          }
        }, STREAM_IDLE_TIMEOUT_MS);
      };

      try {
        resetIdleTimer();
        const { runId, stream } = await api.streamChatRun(sessionId, payload, {
          signal: abortController.signal,
        });
        runIdForLifecycle = runId ?? null;
        if (runIdForLifecycle) {
          activeRunIdRef.current = runIdForLifecycle;
        }

        for await (const event of stream) {
          lastEventTimeRef.current = Date.now();
          resetIdleTimer();
          if (event.event === "keepalive") continue;
          handleRunEvent(event);
        }
      } catch (err) {
        if (!abortController.signal.aborted && !runCompletedRef.current) {
          const message = err instanceof Error ? err.message : String(err);
          setStreamError(message);
          pushStreamErrorToast(message, {
            activeRunId: activeRunIdRef.current,
            lastEventTime: lastEventTimeRef.current,
          });
          const streamError = err instanceof Error ? err : new Error(message);
          if (!runIdForLifecycle) {
            (
              streamError as Error & {
                rollbackOptimisticUserMessage?: boolean;
              }
            ).rollbackOptimisticUserMessage = true;
          }
          throw streamError;
        }
      } finally {
        if (idleTimer) clearTimeout(idleTimer);
        if (runIdForLifecycle && activeRunIdRef.current === runIdForLifecycle) {
          activeRunIdRef.current = null;
        }
        runAbortControllerRef.current = null;
        setIsLoading(false);
        setExecutingTools(new Set());
      }
    },
    [
      activeRunIdRef,
      handleRunEvent,
      lastEventTimeRef,
      runAbortControllerRef,
      runCompletedRef,
      setExecutingTools,
      setIsLoading,
      setStreamError,
      setStreamStalled,
      setToolResultsMap,
    ],
  );

  return { startRunStream };
}
