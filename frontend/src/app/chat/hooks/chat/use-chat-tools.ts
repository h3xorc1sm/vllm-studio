// CRITICAL
"use client";

import { useCallback } from "react";
import type { ToolResult } from "@/lib/types";
import { useAppStore } from "@/store";
import { useShallow } from "zustand/react/shallow";

export function useChatTools() {
  const {
    executingTools,
    toolResultsMap,
    setExecutingTools,
    updateExecutingTools,
    setToolResultsMap,
    updateToolResultsMap,
  } = useAppStore(
    useShallow((state) => ({
      executingTools: state.executingTools,
      toolResultsMap: state.toolResultsMap,
      setExecutingTools: state.setExecutingTools,
      updateExecutingTools: state.updateExecutingTools,
      setToolResultsMap: state.setToolResultsMap,
      updateToolResultsMap: state.updateToolResultsMap,
    })),
  );

  const getToolDefinitions = useCallback((): unknown[] => [], []);

  const clearToolResults = useCallback(() => {
    setToolResultsMap(new Map());
    setExecutingTools(new Set());
  }, [setExecutingTools, setToolResultsMap]);

  return {
    executingTools,
    toolResultsMap,
    getToolDefinitions,
    clearToolResults,
    setExecutingTools,
    updateExecutingTools,
    setToolResultsMap,
    updateToolResultsMap,
  };
}
