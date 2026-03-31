// CRITICAL
"use client";

import { useState } from "react";
import { RefreshButton, PageState } from "@/components/shared";
import { DailyUsageChart } from "./_components/daily-usage-chart";
import { ModelPerformanceTable } from "./_components/model-performance-table";
import { PerformanceDetails } from "./_components/performance-details";
import { SecondaryMetrics } from "./_components/secondary-metrics";
import { OverviewMetrics } from "./_components/overview-metrics";
import { CostBreakdown } from "./_components/cost-breakdown";
import { useUsage } from "./hooks/use-usage";
import { BarChart3, ChevronLeft, ChevronRight } from "lucide-react";

const PERIODS = [
  { key: "d", label: "D" },
  { key: "w", label: "W" },
  { key: "m", label: "M" },
  { key: "y", label: "Y" },
  { key: "all", label: "All" },
] as const;

export default function UsagePage() {
  const [period, setPeriod] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const {
    stats,
    peakMetrics,
    loading,
    error,
    expandedRows,
    sortField,
    sortDirection,
    loadStats,
    dailyByModel,
    modelsForChart,
    sortedModels,
    handleSort,
    toggleRow,
  } = useUsage(period, offset);

  const pageStateRender = PageState({
    loading,
    data: stats,
    hasData: Boolean(stats),
    error,
    onLoad: loadStats,
  });
  if (pageStateRender) return <div className="min-h-full bg-(--surface)">{pageStateRender}</div>;

  if (!stats) return null;

  return (
    <div className="min-h-full bg-(--surface) text-(--fg) overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-(--dim)" />
            <h1 className="text-lg font-medium">Usage Analytics</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Period Toggle */}
            <div className="flex items-center bg-(--bg-subtle) rounded-full p-0.5">
              {period !== "all" && (
                <button
                  onClick={() => setOffset((o) => o + 1)}
                  className="px-1.5 py-1 text-(--dim) hover:text-(--fg) transition-colors"
                  title="Previous period"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              )}
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => { setPeriod(p.key); setOffset(0); }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                    period === p.key
                      ? "bg-(--accent) text-(--fg)"
                      : "text-(--dim) hover:text-(--fg)"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              {period !== "all" && (
                <button
                  onClick={() => setOffset((o) => Math.max(0, o - 1))}
                  disabled={offset === 0}
                  className="px-1.5 py-1 text-(--dim) hover:text-(--fg) transition-colors disabled:opacity-30"
                  title="Next period"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {offset > 0 && (
              <span className="text-xs text-(--dim) tabular-nums">{offset} ago</span>
            )}
            <RefreshButton onRefresh={loadStats} loading={loading} />
          </div>
        </div>

        {/* Overview Metrics */}
        {OverviewMetrics(stats)}

        {/* Cost Breakdown */}
        <CostBreakdown
          period={period}
          promptTokens={stats.totals.prompt_tokens}
          completionTokens={stats.totals.completion_tokens}
        />

        {/* Daily Usage Chart */}
        {DailyUsageChart(stats, dailyByModel, modelsForChart)}

        {/* Model Performance Table */}
        {ModelPerformanceTable(
          sortedModels,
          peakMetrics,
          expandedRows,
          sortField,
          sortDirection,
          handleSort,
          toggleRow,
        )}

        {/* Performance Details & Secondary Metrics */}
        <div className="grid lg:grid-cols-2 gap-6">
          {PerformanceDetails(stats)}
          {SecondaryMetrics(stats, period)}
        </div>
      </div>
    </div>
  );
}
