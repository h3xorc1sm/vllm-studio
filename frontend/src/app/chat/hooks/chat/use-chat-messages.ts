// CRITICAL
"use client";

import { useCallback } from "react";
import type { ChatMessage } from "@/lib/types";
import { useAppStore } from "@/store";

export function useChatMessages() {
  return useAppStore((state) => state.messages);
}

export function useSetChatMessages() {
  const updateMessages = useAppStore((state) => state.updateMessages);
  return useCallback(
    (next: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      if (typeof next === "function") {
        updateMessages(next as (prev: ChatMessage[]) => ChatMessage[]);
      } else {
        updateMessages(() => next);
      }
    },
    [updateMessages],
  );
}
