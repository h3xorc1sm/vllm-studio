// CRITICAL
"use client";

import { useCallback, useMemo, useState } from "react";
import type { ActivityGroup } from "@/app/chat/types";
import { getTurnSummary } from "./tool-categorization";
import { ThinkingItem } from "./thinking-item";
import { ToolItem } from "./tool-item";

export function TurnGroup({
  group,
  hasActiveThinking,
}: {
  group: ActivityGroup;
  hasActiveThinking: boolean;
}) {
  const [collapsed, setCollapsed] = useState(!group.isLatest);

  const summary = useMemo(() => getTurnSummary(group.items), [group.items]);
  const isCollapsed = group.isLatest ? false : collapsed;
  const toggleCollapsed = useCallback(() => {
    if (group.isLatest) return;
    setCollapsed((prev) => !prev);
  }, [group.isLatest]);
  const latestThinkingIndex = useMemo(() => {
    for (let i = group.items.length - 1; i >= 0; i -= 1) {
      if (group.items[i]?.type === "thinking") return i;
    }
    return -1;
  }, [group.items]);

  const visibleItems = useMemo(
    () =>
      group.items.filter((item, index) => {
        if (item.type !== "thinking") return true;
        if (item.isActive) return true;
        return index === latestThinkingIndex;
      }),
    [group.items, latestThinkingIndex],
  );

  return (
    <div className="relative pl-7">
      <span className="absolute left-3.5 top-[1.35rem] h-1.5 w-1.5 rounded-full bg-(--fg)/45" />
      <button
        onClick={toggleCollapsed}
        className="w-full py-3 text-left"
      >
        <div className="flex items-baseline gap-2">
          <span className="text-lg leading-tight text-(--fg)">
            {group.isLatest ? `Current turn ${group.turnNumber || 1}` : `Turn ${group.turnNumber || 1}`}
          </span>
          {!group.isLatest && summary.count > 0 && (
            <span className="text-sm text-(--fg)/60">{summary.label}</span>
          )}
          {group.isLatest && hasActiveThinking && (
            <span className="text-sm text-(--fg)/60">Live</span>
          )}
          {!group.isLatest && (
            <span className="ml-auto text-sm text-(--fg)/60">
              {isCollapsed ? "Show" : "Hide"}
            </span>
          )}
        </div>
      </button>

      {!isCollapsed && (
        <div className="space-y-0 pb-2">
          {visibleItems.map((item) =>
            item.type === "thinking" ? (
              <ThinkingItem key={item.id} content={item.content} isActive={item.isActive} />
            ) : (
              <ToolItem key={item.id} item={item} />
            ),
          )}
        </div>
      )}
    </div>
  );
}
