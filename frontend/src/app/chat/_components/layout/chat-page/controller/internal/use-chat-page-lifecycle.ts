// CRITICAL
"use client";

import { useEffect, type MutableRefObject } from "react";
import { useAppStore } from "@/store";
import { useChatSessionBootstrap } from "../../chat-session-bootstrap";
import { useChatPageTimers } from "../use-chat-page-timers";
import type {
  AgentFilesService,
  AgentStateService,
  ChatPageStore,
  ChatSessionsService,
  MessageMappingService,
  RouterLike,
  SessionIdRef,
  SetMessages,
} from "./types/controller-types";

export interface UseChatPageLifecycleArgs {
  store: ChatPageStore;
  sessions: ChatSessionsService;
  agentFiles: AgentFilesService;
  agentState: AgentStateService;
  messageMapping: MessageMappingService;

  setMessages: SetMessages;
  sessionIdRef: SessionIdRef;

  newChatFromUrl: boolean;
  sessionFromUrl: string | null;

  isLoading: boolean;
  router: RouterLike;

  clearPlan: () => void;
  resetCompaction: () => void;
  executingToolsSize: number;
  activeRunIdRef: MutableRefObject<string | null>;
  runAbortControllerRef: MutableRefObject<AbortController | null>;
  lastEventTimeRef: MutableRefObject<number>;
  setStreamStalled: (next: boolean) => void;

  getLastSessionId: () => string | null;
  setLastSessionId: (sessionId: string) => void;
}

export function useChatPageLifecycle({
  store,
  sessions,
  agentFiles,
  agentState,
  messageMapping,
  setMessages,
  sessionIdRef,
  newChatFromUrl,
  sessionFromUrl,
  isLoading,
  router,
  clearPlan,
  resetCompaction,
  executingToolsSize,
  activeRunIdRef,
  runAbortControllerRef,
  lastEventTimeRef,
  setStreamStalled,
  getLastSessionId,
  setLastSessionId,
}: UseChatPageLifecycleArgs) {
  const { clearAgentFiles, loadAgentFiles } = agentFiles;
  const messagesLength = useAppStore((state) => state.messages.length);

  useChatPageTimers({
    isLoading,
    streamingStartTime: store.streamingStartTime,
    setStreamingStartTime: store.setStreamingStartTime,
    setElapsedSeconds: store.setElapsedSeconds,
    executingToolsSize,
    activeRunIdRef,
    lastEventTimeRef,
    setStreamStalled,
  });

  useChatSessionBootstrap({
    newChatFromUrl,
    sessionFromUrl,
    currentSessionId: sessions.currentSessionId,
    selectedModel: store.selectedModel,
    setSelectedModel: store.setSelectedModel,
    loadSessions: sessions.loadSessions,
    loadSession: sessions.loadSession,
    startNewSession: sessions.startNewSession,
    router,
    setMessages,
    mapStoredMessages: messageMapping.mapStoredMessages,
    hydrateAgentState: agentState.hydrateAgentState,
    loadAgentFiles,
    clearPlan,
    clearAgentFiles,
    setExecutingTools: store.setExecutingTools,
    setToolResultsMap: store.setToolResultsMap,
    resetCompaction,
    getMessagesLength: () => messagesLength,
    sessionIdRef,
    activeRunIdRef,
    runAbortControllerRef,
    getLastSessionId,
    setLastSessionId,
  });

  // Load agent files when agent mode is enabled
  useEffect(() => {
    if (!store.agentMode || !sessions.currentSessionId) return;
    void loadAgentFiles({ sessionId: sessions.currentSessionId });
  }, [loadAgentFiles, sessions.currentSessionId, store.agentMode]);

}
