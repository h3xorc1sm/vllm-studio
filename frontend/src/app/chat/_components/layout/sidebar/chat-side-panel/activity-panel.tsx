// CRITICAL
"use client";

import { Sparkles } from "lucide-react";
import type { ActivityGroup } from "@/app/chat/types";
import { TurnGroup } from "./turn-group";

export interface ActivityPanelProps {
  activityGroups: ActivityGroup[];
  agentPlan?: { steps: Array<{ status: string; title: string }> } | null;
  isLoading?: boolean;
  runStatusLine?: string;
}

export function ActivityPanel({
  activityGroups,
  agentPlan,
  isLoading,
  runStatusLine,
}: ActivityPanelProps) {
  if (activityGroups.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-5">
        <div className="max-w-xs text-center">
          <p className="text-xl leading-tight text-(--fg)/80">No activity yet</p>
          <p className="mt-2 text-base leading-snug text-(--dim)">
            Tool calls, planning, and reasoning updates will appear here.
          </p>
        </div>
      </div>
    );
  }

  const totalSteps = agentPlan?.steps.length ?? 0;
  const doneSteps = agentPlan?.steps.filter((s) => s.status === "done").length ?? 0;
  const currentStep = agentPlan?.steps.find((s) => s.status === "running");
  const hasIncomplete = doneSteps < totalSteps;

  const latestGroup = activityGroups[0];
  const hasActiveThinking = latestGroup?.items.some((i) => i.type === "thinking" && i.isActive);

  return (
    <div className="h-full flex flex-col">
      {isLoading && runStatusLine?.trim() && (
        <div className="px-4 py-2.5 border-b border-(--border)">
          <p className="text-sm leading-snug text-(--dim)">{runStatusLine}</p>
        </div>
      )}

      {totalSteps > 0 && (
        <div className="px-4 py-2.5 border-b border-(--border)">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-(--fg)">Plan</span>
            <span className="text-xs text-(--dim) font-mono">{doneSteps}/{totalSteps}</span>
          </div>
          <div className="mt-2 h-1 w-full bg-(--fg)/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-(--accent) rounded-full transition-all duration-300"
              style={{ width: `${totalSteps > 0 ? (doneSteps / totalSteps) * 100 : 0}%` }}
            />
          </div>
          {isLoading && currentStep && (
            <p className="mt-1.5 text-xs text-(--dim) truncate">{currentStep.title}</p>
          )}
          {isLoading && !currentStep && hasIncomplete && (
            <p className="mt-1.5 text-xs text-(--dim)">Working...</p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="pb-4">
          {activityGroups.map((group) => (
            <TurnGroup
              key={`${group.id}:${group.isLatest ? "latest" : "past"}`}
              group={group}
              hasActiveThinking={group.isLatest && Boolean(hasActiveThinking)}
            />
          ))}

          {isLoading && (
            <div className="px-4 py-3 border-b border-(--border)/50 flex items-start gap-2 text-(--dim)">
              <Sparkles className="h-3.5 w-3.5 mt-0.5 text-(--hl2)" />
              <p className="text-xs leading-relaxed">Agent is working… interleaved reasoning and tool updates stream live.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
