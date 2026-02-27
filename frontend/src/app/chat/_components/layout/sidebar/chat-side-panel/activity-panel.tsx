// CRITICAL
"use client";

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
          <p className="text-xl leading-tight text-(--fg)">No activity yet</p>
          <p className="mt-2 text-base leading-snug text-(--fg)/70">
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
        <div className="px-3 py-3">
          <p className="text-base leading-snug text-(--fg)">{runStatusLine}</p>
        </div>
      )}

      {totalSteps > 0 && (
        <div className="px-3 py-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-base text-(--fg)">Plan</span>
            <span className="text-sm text-(--fg)/70">{doneSteps}/{totalSteps}</span>
          </div>
          <div className="mt-2 h-1 w-full bg-(--fg)/10 overflow-hidden">
            <div
              className="h-full bg-(--fg)/55 transition-all duration-300"
              style={{ width: `${totalSteps > 0 ? (doneSteps / totalSteps) * 100 : 0}%` }}
            />
          </div>
          {isLoading && currentStep && (
            <p className="mt-2 text-sm text-(--fg)/70 truncate">{currentStep.title}</p>
          )}
          {isLoading && !currentStep && hasIncomplete && (
            <p className="mt-2 text-sm text-(--fg)/70">Working...</p>
          )}
        </div>
      )}

      <div className="relative flex-1 overflow-y-auto px-3">
        <div className="absolute left-3.5 top-0 bottom-0 w-px bg-(--fg)/15" />

        <div className="space-y-0 pb-4">
          {activityGroups.map((group) => (
            <TurnGroup
              key={`${group.id}:${group.isLatest ? "latest" : "past"}`}
              group={group}
              hasActiveThinking={group.isLatest && Boolean(hasActiveThinking)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
