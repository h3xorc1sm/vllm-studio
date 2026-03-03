// CRITICAL
"use client";

import { useCallback, useMemo, useRef } from "react";
import type { ChatRunStreamEvent } from "@/lib/api";
import { pushStreamErrorToast } from "@/app/chat/_components/layout/chat-page/controller/internal/use-stream-error-toast";
import { applyRunMachineEffects, type RunMachineEffectRuntime } from "./run-effects";
import {
  createInitialRunMachineState,
  transitionRunMachine,
} from "./run-machine";
import type { RunMachineContext } from "./types";
import type { UseRunEventHandlerArgs } from "@/app/chat/hooks/run/use-run-event-handler/types";

export function useRunMachine(args: UseRunEventHandlerArgs) {
  const {
    currentSessionId,
    currentSessionTitle,
    activeRunIdRef,
    lastEventTimeRef,
    runCompletedRef,
    lastUserInputRef,
    lastAssistantContentRef,
    setStreamStalled,
    setIsLoading,
    setStreamError,
    setAgentPlan,
    generateTitle,
    recordToolExecutionMetadata,
    recordToolResult,
    updateExecutingTools,
    mapAgentMessageToChatMessage,
    upsertMessage,
    loadAgentFiles,
    readAgentFile,
    moveAgentFileVersions,
  } = args;

  const stateRef = useRef(createInitialRunMachineState());

  const runtime = useMemo<RunMachineEffectRuntime>(
    () => ({
      setStreamStalled,
      setIsLoading,
      setStreamError,
      setAgentPlan,
      setActiveRunId: (runId: string | null) => {
        activeRunIdRef.current = runId;
      },
      setRunCompleted: (value: boolean) => {
        runCompletedRef.current = value;
      },
      updateExecutingTools,
      recordToolExecutionMetadata,
      recordToolResult,
      upsertMessage,
      setLastAssistantContent: (content: string) => {
        lastAssistantContentRef.current = content;
      },
      loadAgentFiles,
      readAgentFile,
      moveAgentFileVersions,
      generateTitle,
      pushStreamErrorToast,
    }),
    [
      activeRunIdRef,
      generateTitle,
      lastAssistantContentRef,
      setStreamStalled,
      loadAgentFiles,
      moveAgentFileVersions,
      readAgentFile,
      recordToolExecutionMetadata,
      recordToolResult,
      runCompletedRef,
      setAgentPlan,
      setIsLoading,
      setStreamError,
      setStreamStalled,
      updateExecutingTools,
      upsertMessage,
    ],
  );

  const handleRunEvent = useCallback(
    (event: ChatRunStreamEvent) => {
      const now = Date.now();
      lastEventTimeRef.current = now;
      setStreamStalled(false);

      if (
        activeRunIdRef.current &&
        stateRef.current.activeRunId !== activeRunIdRef.current
      ) {
        stateRef.current = {
          ...stateRef.current,
          phase: "active",
          activeRunId: activeRunIdRef.current,
          runCompleted: false,
        };
      }

      const context: RunMachineContext = {
        currentSessionId,
        currentSessionTitle,
        lastUserInput: lastUserInputRef.current,
        lastAssistantContent: lastAssistantContentRef.current,
      };

      const transition = transitionRunMachine(stateRef.current, context, {
        event,
        now,
        mapAgentMessageToChatMessage: (rawMessage, messageId, runMeta) =>
          mapAgentMessageToChatMessage(rawMessage, messageId, runMeta),
      });

      stateRef.current = transition.state;
      applyRunMachineEffects(transition.effects, runtime);
    },
    [
      activeRunIdRef,
      currentSessionId,
      currentSessionTitle,
      lastAssistantContentRef,
      lastEventTimeRef,
      lastUserInputRef,
      mapAgentMessageToChatMessage,
      runtime,
      setStreamStalled,
    ],
  );

  return { handleRunEvent };
}
