// CRITICAL
"use client";

import { useMemo } from "react";
import { useAppStore } from "@/store";
import type { ChatMessage, ToolResult } from "@/lib/types";
import { buildRunStatusText } from "./run-status";

export interface UseThinkingSnippetArgs {
  isLoading: boolean;
  streamStalled: boolean;
  executingTools: Set<string>;
  toolResultsMap: Map<string, ToolResult>;
  thinkingStateContent: string;
  messages: ChatMessage[];
}

export function useThinkingSnippet({
  isLoading,
  streamStalled,
  executingTools,
  toolResultsMap,
  thinkingStateContent: _thinkingStateContent,
  messages,
}: UseThinkingSnippetArgs) {
  // Subscribe to elapsedSeconds here (not in the parent controller)
  // so that the 1-second timer ticks don't re-render the entire page tree.
  const elapsedSeconds = useAppStore((state) => state.elapsedSeconds);

  return useMemo(() => {
    return buildRunStatusText({
      isLoading,
      streamStalled,
      elapsedSeconds,
      executingTools,
      toolResultsMap,
      messages,
    });
  }, [elapsedSeconds, executingTools, isLoading, messages, streamStalled, toolResultsMap]);
}
