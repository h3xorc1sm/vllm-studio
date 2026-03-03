// CRITICAL
"use client";

import { useEffect } from "react";
import type { ChatMessage, ChatSessionDetail, StoredMessage } from "@/lib/types";

export interface UseChatPageEventsArgs {
  currentSessionId: string | null;
  hydrateAgentState: (session: ChatSessionDetail) => void;
  mapStoredMessages: (messages: StoredMessage[]) => ChatMessage[];
  startNewSession: () => void;
  updateMessages: (updater: (messages: ChatMessage[]) => ChatMessage[]) => void;
}

export function useChatPageEvents({
  currentSessionId,
  hydrateAgentState,
  mapStoredMessages,
  startNewSession,
  updateMessages,
}: UseChatPageEventsArgs) {
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ type?: string; data?: Record<string, unknown> }>;
      const type = custom.detail?.type;
      const data = custom.detail?.data ?? {};
      if (!type || !data) return;

      switch (type) {
        case "chat_message_upserted": {
          const sessionId = String(data["session_id"] ?? "");
          if (!currentSessionId || sessionId !== currentSessionId) return;
          const message = data["message"] as StoredMessage | undefined;
          if (!message) return;
          const mapped = mapStoredMessages([message])[0];
          if (!mapped) return;
          updateMessages((current) => {
            const index = current.findIndex((entry) => entry.id === mapped.id);
            return index >= 0
              ? [...current.slice(0, index), mapped, ...current.slice(index + 1)]
              : [...current, mapped];
          });
          break;
        }
        case "chat_session_deleted": {
          const sessionId = String(data["session_id"] ?? "");
          if (currentSessionId && sessionId === currentSessionId) {
            startNewSession();
          }
          break;
        }
        case "chat_session_updated": {
          const sessionId = String(data["session_id"] ?? "");
          if (currentSessionId && sessionId === currentSessionId) {
            const session = data["session"] as Record<string, unknown> | undefined;
            if (session) {
              hydrateAgentState(session as unknown as ChatSessionDetail);
            }
          }
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("vllm:chat-event", handler as EventListener);
    return () => {
      window.removeEventListener("vllm:chat-event", handler as EventListener);
    };
  }, [
    currentSessionId,
    hydrateAgentState,
    mapStoredMessages,
    updateMessages,
    startNewSession,
  ]);
}

