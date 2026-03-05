// CRITICAL
"use client";

import { useMemo } from "react";
import { thinkingParser } from "../message-renderer";
import { isToolCallOnlyText } from "@/app/chat/hooks/chat/use-chat-message-mapping/helpers";
import type { ChatMessage } from "@/lib/types";

export const deriveMessageContent = ({
  role,
  parts,
}: {
  role: ChatMessage["role"];
  parts: ChatMessage["parts"];
}): {
  textContent: string;
  thinkingContent: string;
} => {
  const isUser = role === "user";

  let rawTextContent = "";
  let reasoningFromParts = "";

  for (const part of parts) {
    if (part.type === "text") {
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string" && text && !isToolCallOnlyText(text)) rawTextContent += text;
      continue;
    }
    if (part.type === "reasoning") {
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string" && text)
        reasoningFromParts += (reasoningFromParts ? "\n" : "") + text;
      continue;
    }
  }

  if (isUser) {
    return { textContent: rawTextContent, thinkingContent: reasoningFromParts };
  }

  const lower = rawTextContent.toLowerCase();
  const hasThinkTags =
    lower.includes("<think") ||
    lower.includes("</think") ||
    lower.includes("<thinking") ||
    lower.includes("</thinking");
  const parsedThinking = hasThinkTags ? thinkingParser.parse(rawTextContent) : null;
  const textContent = hasThinkTags ? parsedThinking?.mainContent || "" : rawTextContent;
  const thinkingFromTags = hasThinkTags ? parsedThinking?.thinkingContent || "" : "";
  const thinkingContent = reasoningFromParts || thinkingFromTags;

  return { textContent, thinkingContent };
};

export function useMessageDerived({
  role,
  parts,
}: {
  role: ChatMessage["role"];
  parts: ChatMessage["parts"];
}): {
  textContent: string;
  thinkingContent: string;
} {
  return useMemo(() => deriveMessageContent({ role, parts }), [parts, role]);
}
