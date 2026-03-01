// CRITICAL
"use client";

import { useState } from "react";
import { Ban, ListChecks } from "lucide-react";
import * as Icons from "../icons";
import type { AgentPlan, AgentPlanStep } from "./agent-types";

interface AgentPlanDrawerProps {
  plan: AgentPlan;
  onClear: () => void;
}

function StepIcon({ status }: { status: AgentPlanStep["status"] }) {
  switch (status) {
    case "done":
      return <Icons.Check className="h-3 w-3 text-emerald-400 shrink-0" strokeWidth={2.5} />;
    case "running":
      return <Icons.Loader2 className="h-3 w-3 text-blue-400 animate-spin shrink-0" />;
    case "blocked":
      return <Ban className="h-3 w-3 text-red-400 shrink-0" />;
    default:
      return <Icons.Circle className="h-2.5 w-2.5 text-(--dim)/40 shrink-0" />;
  }
}

export function AgentPlanDrawer({ plan, onClear }: AgentPlanDrawerProps) {
  const [collapsed, setCollapsed] = useState(false);

  const { steps } = plan;
  const doneCount = steps.filter((s) => s.status === "done").length;
  const allDone = doneCount === steps.length;
  const currentIndex = steps.findIndex((s) => s.status !== "done");

  return (
    <div className="border-b border-(--border) bg-(--bg) overflow-hidden rounded-t-3xl">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-4 py-2 hover:bg-(--fg)/[0.03] transition-colors"
      >
        {collapsed ? (
          <Icons.ChevronRight className="h-3 w-3 text-(--dim) shrink-0" />
        ) : (
          <Icons.ChevronDown className="h-3 w-3 text-(--dim) shrink-0" />
        )}

        <ListChecks className="h-3.5 w-3.5 text-(--accent) shrink-0" />

        <span className="text-[11px] font-medium text-(--fg)">Plan</span>

        <span className="text-[10px] text-(--dim) font-mono">
          {allDone ? `${steps.length}/${steps.length} steps` : `${doneCount}/${steps.length} steps`}
        </span>

        {/* Mini progress dots */}
        <div className="flex gap-0.75 ml-auto mr-1">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                s.status === "done"
                  ? "bg-emerald-500"
                  : s.status === "running"
                    ? "bg-blue-400 animate-pulse"
                    : s.status === "blocked"
                      ? "bg-red-400"
                      : "bg-(--fg)/12"
              }`}
            />
          ))}
        </div>

        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onClear();
            }
          }}
          className="p-0.5 rounded hover:bg-(--fg)/[0.06] text-(--dim) shrink-0 cursor-pointer"
          title="Clear plan"
        >
          <Icons.X className="h-3 w-3" />
        </span>
      </button>

      {/* Steps */}
      {!collapsed && (
        <div className="px-4 pb-2 space-y-0">
          {steps.map((step, i) => {
            const isCurrent = i === currentIndex && step.status !== "blocked";
            return (
              <div
                key={step.id}
                className={`flex items-center gap-2 py-1 px-1 rounded transition-colors ${
                  isCurrent ? "bg-(--fg)/[0.04]" : ""
                }`}
              >
                <StepIcon status={step.status} />
                <span
                  className={`text-[11px] leading-snug ${
                    step.status === "done"
                      ? "text-(--dim) line-through decoration-(--border)"
                      : isCurrent
                        ? "text-(--fg)"
                        : "text-(--dim)"
                  }`}
                >
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
