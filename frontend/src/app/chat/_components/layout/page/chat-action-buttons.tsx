// CRITICAL
"use client";

import { memo } from "react";
import { PanelRightOpen, Gauge, Sliders, PieChart, Share2 } from "lucide-react";

interface ChatActionButtonsProps {
  activityCount: number;
  hasActiveThinking?: boolean;
  onOpenActivity: () => void;
  onOpenContext: () => void;
  onOpenSettings: () => void;
  onOpenUsage: () => void;
  onOpenExport: () => void;
}

function ChatActionButtonsBase({
  activityCount,
  hasActiveThinking = false,
  onOpenActivity,
  onOpenContext,
  onOpenSettings,
  onOpenUsage,
  onOpenExport,
}: ChatActionButtonsProps) {
  return (
    <div className="absolute right-3 top-3 z-10 hidden md:flex flex-col items-center gap-1.5">
      <button
        onClick={onOpenActivity}
        className="relative p-1.5 rounded-lg hover:bg-(--fg)/[0.08] transition-colors"
        title="Show activity"
      >
        <PanelRightOpen className={`h-4 w-4 ${hasActiveThinking ? "text-(--hl2)" : "text-(--dim)"}`} />
        {activityCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-(--accent) rounded-full text-[9px] text-white font-medium flex items-center justify-center">
            {activityCount}
          </span>
        )}
      </button>
      <button
        onClick={onOpenContext}
        className="p-1.5 rounded-lg hover:bg-(--fg)/[0.08] transition-colors"
        title="Context"
      >
        <Gauge className="h-4 w-4 text-(--dim)" />
      </button>
      <button
        onClick={onOpenSettings}
        className="p-1.5 rounded-lg hover:bg-(--fg)/[0.08] transition-colors"
        title="Settings"
      >
        <Sliders className="h-4 w-4 text-(--dim)" />
      </button>
      <button
        onClick={onOpenUsage}
        className="p-1.5 rounded-lg hover:bg-(--fg)/[0.08] transition-colors"
        title="Usage"
      >
        <PieChart className="h-4 w-4 text-(--dim)" />
      </button>
      <button
        onClick={onOpenExport}
        className="p-1.5 rounded-lg hover:bg-(--fg)/[0.08] transition-colors"
        title="Export"
      >
        <Share2 className="h-4 w-4 text-(--dim)" />
      </button>
    </div>
  );
}

function areChatActionButtonsPropsEqual(
  prev: ChatActionButtonsProps,
  next: ChatActionButtonsProps,
): boolean {
  return (
    prev.activityCount === next.activityCount &&
    prev.hasActiveThinking === next.hasActiveThinking &&
    prev.onOpenActivity === next.onOpenActivity &&
    prev.onOpenContext === next.onOpenContext &&
    prev.onOpenSettings === next.onOpenSettings &&
    prev.onOpenUsage === next.onOpenUsage &&
    prev.onOpenExport === next.onOpenExport
  );
}

export const ChatActionButtons = memo(ChatActionButtonsBase, areChatActionButtonsPropsEqual);
