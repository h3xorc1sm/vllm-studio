// CRITICAL
"use client";

import { useCallback, useEffect, useRef } from "react";
import type { SidebarTab } from "../../sidebar/unified-sidebar";

export interface UseChatSidebarControllerArgs {
  currentSessionId: string | null;
  sessionFromUrl: string | null;
  activityPanelVisible: boolean;
  thinkingActive: boolean;
  isLoading: boolean;
  executingToolsSize: number;
  activityGroupsLength: number;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  selectAgentFile: (path: string | null, sessionId: string | null) => void;
}

export function shouldAutoOpenActivityPanel({
  hasActivity,
  hadActivity,
  autoOpenedActivity,
  sidebarOpen,
  currentSessionId,
  sessionFromUrl,
  isMobile,
}: {
  hasActivity: boolean;
  hadActivity: boolean;
  autoOpenedActivity: boolean;
  sidebarOpen: boolean;
  currentSessionId: string | null;
  sessionFromUrl: string | null;
  isMobile: boolean;
}) {
  if (!hasActivity) return false;
  if (hadActivity) return false;
  if (autoOpenedActivity) return false;
  if (sidebarOpen) return false;
  if (!currentSessionId && !sessionFromUrl) return false;
  if (isMobile) return false;
  return true;
}

export function useChatSidebarController({
  currentSessionId,
  sessionFromUrl,
  activityPanelVisible,
  thinkingActive,
  isLoading,
  executingToolsSize,
  activityGroupsLength,
  sidebarOpen,
  setSidebarOpen,
  setSidebarTab,
  selectAgentFile,
}: UseChatSidebarControllerArgs) {
  const autoOpenedActivityRef = useRef(false);

  useEffect(() => {
    autoOpenedActivityRef.current = false;
  }, [currentSessionId]);

  // Auto-open activity panel only on first activity (not every change)
  const hadActivityRef = useRef(false);
  const hasActivity =
    (activityPanelVisible ? thinkingActive : isLoading) ||
    executingToolsSize > 0 ||
    activityGroupsLength > 0;

  useEffect(() => {
    const mobileViewport = typeof window !== "undefined" && window.innerWidth < 768;
    const shouldAutoOpen = shouldAutoOpenActivityPanel({
      hasActivity,
      hadActivity: hadActivityRef.current,
      autoOpenedActivity: autoOpenedActivityRef.current,
      sidebarOpen,
      currentSessionId,
      sessionFromUrl,
      isMobile: mobileViewport,
    });

    if (!hasActivity) {
      hadActivityRef.current = false;
      return;
    }
    if (!shouldAutoOpen) {
      if (mobileViewport) {
        hadActivityRef.current = true;
      }
      return;
    }

    if (mobileViewport) {
      hadActivityRef.current = true;
      return;
    }

    hadActivityRef.current = true;
    setSidebarOpen(true);
    setSidebarTab("activity");
    autoOpenedActivityRef.current = true;
  }, [currentSessionId, hasActivity, sessionFromUrl, sidebarOpen, setSidebarOpen, setSidebarTab]);

  const openActivityPanel = useCallback(() => {
    setSidebarOpen(true);
    setSidebarTab("activity");
  }, [setSidebarOpen, setSidebarTab]);

  const openContextPanel = useCallback(() => {
    setSidebarOpen(true);
    setSidebarTab("context");
  }, [setSidebarOpen, setSidebarTab]);

  const handleOpenAgentFile = useCallback(
    (path: string) => {
      setSidebarOpen(true);
      setSidebarTab("files");
      selectAgentFile(path, sessionFromUrl || currentSessionId);
    },
    [currentSessionId, selectAgentFile, sessionFromUrl, setSidebarOpen, setSidebarTab],
  );

  return { openActivityPanel, openContextPanel, handleOpenAgentFile };
}
