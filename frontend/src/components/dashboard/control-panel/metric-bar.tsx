// CRITICAL
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMotionValueEvent, useSpring } from "framer-motion";
import type { GPU, Metrics, ProcessInfo } from "@/lib/types";
import { toGB, toGBFromMB } from "@/lib/formatters";

interface MetricBarProps {
  metrics: Metrics | null;
  gpus: GPU[];
  currentProcess: ProcessInfo | null;
  logs?: string[];
}

const TOKENS_PER_SECOND_PATTERN = /([0-9]+(?:\.[0-9]+)?)\s*tokens\s+per\s+second/i;
const PROMPT_EVAL_PATTERN = /prompt eval time\s*=/i;
const EVAL_PATTERN = /(^|\s)eval time\s*=/i;

const parseTokensPerSecond = (line: string): number => {
  const match = line.match(TOKENS_PER_SECOND_PATTERN);
  if (!match?.[1]) return 0;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const parseLlamacppThroughputFromLogs = (
  lines: string[] | undefined,
): { prefill: number; generation: number } => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { prefill: 0, generation: 0 };
  }

  let promptLine = "";
  let evalLine = "";
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? "";
    if (!promptLine && PROMPT_EVAL_PATTERN.test(line)) {
      promptLine = line;
      continue;
    }
    if (!evalLine && EVAL_PATTERN.test(line) && !PROMPT_EVAL_PATTERN.test(line)) {
      evalLine = line;
    }
    if (promptLine && evalLine) break;
  }

  return {
    prefill: parseTokensPerSecond(promptLine),
    generation: parseTokensPerSecond(evalLine),
  };
};

const firstPositive = (...values: Array<number | null | undefined>): number => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return 0;
};

export function MetricBar({ metrics, gpus, currentProcess, logs }: MetricBarProps) {
  const isLlamacpp = currentProcess?.backend === "llamacpp";
  const logThroughput = useMemo(() => parseLlamacppThroughputFromLogs(logs), [logs]);
  const rawGenTps = firstPositive(
    metrics?.session_avg_generation,
    metrics?.generation_throughput,
    isLlamacpp ? logThroughput.generation : 0,
  );
  const rawPrefillTps = firstPositive(
    metrics?.session_avg_prefill,
    metrics?.prompt_throughput,
    isLlamacpp ? logThroughput.prefill : 0,
  );
  const genTps = useHeldThroughput(rawGenTps);
  const prefillTps = useHeldThroughput(rawPrefillTps);
  const animatedGenTps = useAnimatedNumber(genTps);
  const animatedPrefillTps = useAnimatedNumber(prefillTps);
  const genPeak = firstPositive(
    metrics?.session_peak_generation,
    metrics?.peak_generation_tps,
    isLlamacpp ? logThroughput.generation : 0,
  );
  const prefillPeak = firstPositive(
    metrics?.session_peak_prefill,
    metrics?.peak_prefill_tps,
    isLlamacpp ? logThroughput.prefill : 0,
  );
  const totalPower = gpus.reduce((sum, g) => sum + (g.power_draw || 0), 0);
  const totalMemUsed = gpus.reduce((sum, g) => {
    if (g.memory_used_mb !== undefined && g.memory_used_mb !== null) {
      return sum + toGBFromMB(g.memory_used_mb);
    }
    return sum + toGB(g.memory_used ?? 0);
  }, 0);
  const totalMemMax = gpus.reduce((sum, g) => {
    if (g.memory_total_mb !== undefined && g.memory_total_mb !== null) {
      return sum + toGBFromMB(g.memory_total_mb);
    }
    return sum + toGB(g.memory_total ?? 0);
  }, 0);
  const kvCache = metrics?.kv_cache_usage ? Math.round(metrics.kv_cache_usage * 100) : 0;
  const totalCost = metrics?.lifetime_energy_kwh
    ? (metrics.lifetime_energy_kwh * 0.5).toFixed(2)
    : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-foreground/5">
      <MetricBox
        label="generation"
        value={genTps > 0 ? animatedGenTps.toFixed(1) : "--"}
        unit="tok/s"
        peak={genPeak > 0 ? genPeak.toFixed(1) : undefined}
        live={genTps > 0}
      />
      <MetricBox
        label="prefill"
        value={prefillTps > 0 ? animatedPrefillTps.toFixed(1) : "--"}
        unit="tok/s"
        peak={prefillPeak > 0 ? prefillPeak.toFixed(1) : undefined}
        live={prefillTps > 0}
      />
      <MetricBox
        label="memory"
        value={`${totalMemUsed.toFixed(1)}/${totalMemMax.toFixed(0)}`}
        unit="GB"
      />
      <MetricBox label="kv cache" value={kvCache > 0 ? kvCache.toString() : "--"} unit="%" />
      <MetricBox label="power" value={Math.round(totalPower).toString()} unit="W" />
      {totalCost && <MetricBox label="cost" value={totalCost} unit="PLN" accent />}
    </div>
  );
}

function MetricBox({
  label,
  value,
  unit,
  peak,
  live,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  peak?: string;
  live?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="bg-background p-4">
      <div className="text-[10px] uppercase tracking-widest text-foreground/30 mb-1 flex items-center gap-1.5">
        {label}
        {live && <span className="h-1.5 w-1.5 rounded-full bg-(--hl2) animate-pulse" />}
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={`text-2xl font-light tabular-nums transition-colors duration-300 ${
            accent ? "text-(--hl2)" : live ? "text-(--fg)" : ""
          }`}
        >
          {value}
        </span>
        <span className="text-xs text-foreground/30">{unit}</span>
      </div>
      {peak && <div className="text-[10px] text-foreground/20 mt-1 font-mono">peak {peak}</div>}
    </div>
  );
}

function useHeldThroughput(value: number, holdMs = 12_000): number {
  const [heldValue, setHeldValue] = useState(() => (value > 0 ? value : 0));
  const lastPositiveAtRef = useRef(value > 0 ? Date.now() : 0);

  useEffect(() => {
    if (value > 0) {
      lastPositiveAtRef.current = Date.now();
      setHeldValue(value);
      return;
    }
    const lastPositiveAt = lastPositiveAtRef.current;
    if (!lastPositiveAt) {
      setHeldValue(0);
      return;
    }
    const elapsed = Date.now() - lastPositiveAt;
    if (elapsed >= holdMs) {
      setHeldValue(0);
      return;
    }
    const timer = window.setTimeout(() => setHeldValue(0), holdMs - elapsed);
    return () => window.clearTimeout(timer);
  }, [holdMs, value]);

  return heldValue;
}

function useAnimatedNumber(value: number): number {
  const spring = useSpring(value, {
    stiffness: 190,
    damping: 26,
    mass: 0.7,
  });
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useMotionValueEvent(spring, "change", (latest) => {
    setDisplayValue(latest);
  });

  return Number.isFinite(displayValue) ? displayValue : value;
}
