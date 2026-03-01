// CRITICAL
"use client";

import { ChevronRight } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";

const THINKING_PREVIEW_LIMIT = 260;

interface ThinkingItemProps {
  content?: string;
  isActive?: boolean;
}

export const ThinkingItem = memo(
  function ThinkingItem({ content, isActive }: ThinkingItemProps) {
    const [expanded, setExpanded] = useState(false);
    const toggleExpanded = useCallback(() => setExpanded((prev) => !prev), []);

    const fullText = useMemo(() => (content ?? "").trim(), [content]);
    const compactText = useMemo(() => fullText.replace(/\s+/g, " "), [fullText]);
    const hasContent = fullText.length > 0;
    const isTruncated = compactText.length > THINKING_PREVIEW_LIMIT;
    const previewText = compactText.slice(0, THINKING_PREVIEW_LIMIT);
    const displayText = expanded || !isTruncated ? fullText : previewText;

    return (
      <div className="flex items-start gap-2.5 pl-1">
        <span
          className={`mt-1.5 inline-flex h-1.5 w-1.5 shrink-0 rounded-full ${
            isActive ? "bg-(--hl2) animate-pulse" : "bg-(--dim)/70"
          }`}
        />

        <div className="min-w-0 flex-1">
          {hasContent ? (
            <p
              className={`text-xs leading-relaxed break-words whitespace-pre-wrap ${
                isActive ? "text-(--fg)/90" : "text-(--dim)"
              }`}
            >
              {displayText}
              {!expanded && isTruncated ? "…" : ""}
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-(--dim)">Thinking…</p>
          )}

          {hasContent && isTruncated && (
            <button
              onClick={toggleExpanded}
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-(--dim) hover:text-(--fg) transition-colors"
            >
              <span>{expanded ? "Show less" : "Show more"}</span>
              <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? "-rotate-90" : "rotate-90"}`} />
            </button>
          )}
        </div>
      </div>
    );
  },
  function areThinkingItemPropsEqual(prev, next) {
    return prev.content === next.content && prev.isActive === next.isActive;
  },
);
