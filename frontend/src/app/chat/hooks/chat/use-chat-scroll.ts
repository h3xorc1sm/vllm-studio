// CRITICAL
"use client";

import { useEffect, useRef } from "react";
import { useRafThrottle } from "../ui/use-raf-throttle";

const BOTTOM_STICKY_THRESHOLD_PX = 160;

type UseChatScrollArgs = {
  isLoading: boolean;
  messageCount: number;
};

export function useChatScroll({ isLoading, messageCount }: UseChatScrollArgs): {
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  handleScroll: () => void;
} {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const userScrolledUpRef = useRef(false);

  const handleScroll = useRafThrottle(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    userScrolledUpRef.current = distanceFromBottom >= BOTTOM_STICKY_THRESHOLD_PX;
  });

  const prevMessageCountRef = useRef(messageCount);
  useEffect(() => {
    // Only scroll when message count changes (new message added) or loading state changes.
    if (messageCount === prevMessageCountRef.current && isLoading) return;
    prevMessageCountRef.current = messageCount;

    if (!userScrolledUpRef.current) {
      messagesEndRef.current?.scrollIntoView({
        behavior: isLoading ? "auto" : "smooth",
      });
    }
  }, [isLoading, messageCount]);

  // While streaming, the last assistant message grows without changing `messageCount`.
  // Keep the view pinned to bottom unless the user has scrolled up.
  // IMPORTANT: avoid polling scrollHeight (expensive) — use ResizeObserver instead.
  const lastPinnedAtRef = useRef<number>(0);
  useEffect(() => {
    if (!isLoading) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    const endNode = messagesEndRef.current;
    if (!endNode) return;

    const maybePinToBottom = () => {
      if (userScrolledUpRef.current) return;
      const now = Date.now();
      // Guard against ResizeObserver cascades triggering too many scroll operations.
      if (now - lastPinnedAtRef.current < 80) return;
      lastPinnedAtRef.current = now;
      endNode.scrollIntoView({ behavior: "auto" });
    };

    const ro = new ResizeObserver(() => {
      // Schedule after layout; avoids scroll jitter during streaming.
      window.requestAnimationFrame(maybePinToBottom);
    });

    ro.observe(container);

    // Initial pin when streaming starts.
    window.requestAnimationFrame(maybePinToBottom);

    return () => {
      ro.disconnect();
    };
  }, [isLoading]);

  return {
    messagesEndRef,
    messagesContainerRef,
    handleScroll,
  };
}
