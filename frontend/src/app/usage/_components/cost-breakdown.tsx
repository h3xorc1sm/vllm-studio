// CRITICAL
"use client";

import { useEffect, useState } from "react";
import type { Metrics } from "@/lib/types";
import { Zap, Clock, Calendar, TrendingUp, Cloud } from "lucide-react";
import api from "@/lib/api";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  PLN: "zł",
  CAD: "C$",
  AUD: "A$",
  CHF: "CHF",
  JPY: "¥",
  CNY: "¥",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  CZK: "Kč",
  KRW: "₩",
  INR: "₹",
  BRL: "R$",
  MXN: "$",
  ZAR: "R",
  SGD: "S$",
  HKD: "HK$",
  NZD: "NZ$",
  TWD: "NT$",
  THB: "฿",
};

const getCurrencySymbol = (ticker: string): string => CURRENCY_SYMBOLS[ticker] ?? ticker;

interface CostCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subvalue?: string;
}

function CostCard({ icon: Icon, label, value, subvalue }: CostCardProps) {
  return (
    <div className="bg-(--surface) rounded-lg p-4">
      <div className="flex items-center gap-2 text-(--dim) mb-2">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-xl font-medium tabular-nums tracking-tight">{value}</div>
      {subvalue && <div className="mt-1 text-xs text-(--dim)">{subvalue}</div>}
    </div>
  );
}

const PERIOD_LABELS: Record<string, string> = {
  all: "All time",
  d: "Last 24 hours",
  w: "Last 7 days",
  m: "Last 30 days",
  y: "Last year",
};

interface CloudPricing {
  anthropic_input: number;
  anthropic_output: number;
  openai_input: number;
  openai_output: number;
}

export function CostBreakdown({ period, promptTokens, completionTokens }: { period?: string; promptTokens?: number; completionTokens?: number }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [cloudPricing, setCloudPricing] = useState<CloudPricing>({
    anthropic_input: 3.0,
    anthropic_output: 15.0,
    openai_input: 2.5,
    openai_output: 10.0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);
        const [data, settings] = await Promise.all([
          api.getLifetimeMetrics(period),
          api.getStudioSettings(),
        ]);
        setMetrics(data);
        if (settings.effective) {
          setCloudPricing({
            anthropic_input: settings.effective.cloud_price_anthropic_input ?? 3.0,
            anthropic_output: settings.effective.cloud_price_anthropic_output ?? 15.0,
            openai_input: settings.effective.cloud_price_openai_input ?? 2.5,
            openai_output: settings.effective.cloud_price_openai_output ?? 10.0,
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load cost data");
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, [period]);

  if (loading) {
    return (
      <div className="bg-(--surface) rounded-lg p-4 sm:p-6">
        <div className="text-xs text-(--dim) uppercase tracking-wider mb-4">Cost Breakdown</div>
        <div className="flex items-center justify-center py-8">
          <Zap className="h-5 w-5 text-(--dim) animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-(--surface) rounded-lg p-4 sm:p-6">
        <div className="text-xs text-(--dim) uppercase tracking-wider mb-4">Cost Breakdown</div>
        <div className="text-sm text-(--err)">{error}</div>
      </div>
    );
  }

  const currencySymbol = getCurrencySymbol(metrics?.electricity_currency ?? "USD");
  const rate = metrics?.electricity_rate ?? 0.11;

  const lifetimeCost = metrics?.total_cost
    ? parseFloat(metrics.total_cost)
    : metrics?.energy_kwh
      ? metrics.energy_kwh * rate
      : 0;

  const currentPowerWatts = metrics?.current_power_watts ?? 0;
  const hourlyCost = (currentPowerWatts * rate) / 1000;

  const uptimeHours = metrics?.uptime_hours ?? 0;
  const avgCostPerDay = uptimeHours > 0 ? lifetimeCost / (uptimeHours / 24) : 0;

  return (
    <div className="bg-(--surface) rounded-lg p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-(--dim) uppercase tracking-wider">Cost Breakdown</div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-(--dim)" />
          <span className="text-xs text-(--dim)">{PERIOD_LABELS[period ?? "all"] ?? "All time"}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <CostCard
          icon={Zap}
          label={period && period !== "all" ? "Cost" : "Lifetime Cost"}
          value={`${currencySymbol}${lifetimeCost.toFixed(2)}`}
          subvalue={metrics?.energy_kwh ? `${metrics.energy_kwh.toFixed(2)} kWh` : undefined}
        />
        <CostCard
          icon={TrendingUp}
          label="Current Hourly Cost"
          value={`${currencySymbol}${hourlyCost.toFixed(4)}`}
          subvalue={currentPowerWatts > 0 ? `${currentPowerWatts.toFixed(0)} W` : "No active load"}
        />
        <CostCard
          icon={Clock}
          label="Avg Daily Cost"
          value={`${currencySymbol}${avgCostPerDay.toFixed(2)}`}
          subvalue={uptimeHours > 0 ? `${uptimeHours.toFixed(1)} hours uptime` : undefined}
        />
        <CostCard
          icon={Zap}
          label="Rate"
          value={`${currencySymbol}${rate.toFixed(3)}/kWh`}
          subvalue={metrics?.electricity_currency ?? "USD"}
        />
      </div>

      {(promptTokens !== undefined && completionTokens !== undefined) && (
        <>
          <div className="flex items-center justify-between mt-6 mb-3">
            <div className="flex items-center gap-2 text-(--dim)">
              <Cloud className="h-3.5 w-3.5" />
              <span className="text-xs uppercase tracking-wider">Cloud API Equivalent</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {(() => {
              const ptok = (promptTokens ?? 0) / 1_000_000;
              const ctok = (completionTokens ?? 0) / 1_000_000;
              const anthropicTotal = ptok * cloudPricing.anthropic_input + ctok * cloudPricing.anthropic_output;
              const openaiTotal = ptok * cloudPricing.openai_input + ctok * cloudPricing.openai_output;
              const anthropicInput = ptok * cloudPricing.anthropic_input;
              const anthropicOutput = ctok * cloudPricing.anthropic_output;
              const openaiInput = ptok * cloudPricing.openai_input;
              const openaiOutput = ctok * cloudPricing.openai_output;
              return (
                <>
                  <CostCard
                    icon={Cloud}
                    label="Claude Sonnet 4.5"
                    value={`$${anthropicTotal.toFixed(2)}`}
                    subvalue={`$${anthropicInput.toFixed(2)} in · $${anthropicOutput.toFixed(2)} out`}
                  />
                  <CostCard
                    icon={Cloud}
                    label="GPT-4o"
                    value={`$${openaiTotal.toFixed(2)}`}
                    subvalue={`$${openaiInput.toFixed(2)} in · $${openaiOutput.toFixed(2)} out`}
                  />
                </>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
