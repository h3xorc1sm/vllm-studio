// CRITICAL
"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";

export const ThinkingItem = memo(
  function ThinkingItem({ content, isActive }: { content?: string; isActive?: boolean }) {
    const [expanded, setExpanded] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const toggleExpanded = useCallback(() => setExpanded((prev) => !prev), []);

    useEffect(() => {
      if (isActive && expanded && contentRef.current) {
        contentRef.current.scrollTop = contentRef.current.scrollHeight;
      }
    }, [content, isActive, expanded]);

    const preview = content ? content.trim().slice(0, 140) : "";
    const hasPreviewOverflow = Boolean(content && content.trim().length > 140);

    return (
      <div className="relative pl-7 pr-1 py-2">
        <span className="absolute left-3.5 top-3.5 h-1.25 w-1.25 rounded-full bg-(--fg)/35" />
        <button
          onClick={toggleExpanded}
          className="flex items-baseline gap-2 w-full text-left"
          disabled={!content}
        >
          <span className="text-base leading-tight text-(--fg)">{isActive ? "Thinking" : "Reasoning"}</span>
          {isActive && <span className="text-sm text-(--fg)/60">Live</span>}
          {content && (
            <span className="ml-auto text-sm text-(--fg)/60">
              {expanded ? "Less" : "More"}
            </span>
          )}
        </button>

        {!expanded && preview && (
          <p className="mt-1 text-sm leading-relaxed text-(--fg)/70 line-clamp-2">
            {preview}
            {hasPreviewOverflow ? "..." : ""}
          </p>
        )}

        {expanded && content && (
          <div
            ref={contentRef}
            className="mt-2 max-h-56 overflow-y-auto text-base leading-relaxed text-(--fg)/85 whitespace-pre-wrap break-words scrollbar-thin"
          >
            {content}
          </div>
        )}
      </div>
    );
  },
  function areThinkingItemPropsEqual(prev, next) {
    return prev.content === next.content && prev.isActive === next.isActive;
  },
);
