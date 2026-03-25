// CRITICAL
import type { AppContext } from "../../../types/context";
import { getGpuInfo } from "../platform/gpu";
import { getSystemRuntimeInfo } from "../runtime/runtime-info";
import { delay } from "../../../core/async";
import { listLogFiles, resolveExistingLogPath, tailFileLines } from "../../../core/log-files";
import { fetchLocal } from "../../../http/local-fetch";
import { isRecipeRunning } from "../recipes/recipe-matching";
import type { ProcessInfo, Recipe } from "../types";
import { loadPersistedConfig } from "../../../config/persisted-config";
import {
  METRICS_COLLECT_INTERVAL_MS,
  METRICS_HTTP_TIMEOUT_MS,
  METRICS_RUNTIME_SUMMARY_INTERVAL_MS,
  METRICS_LIFETIME_UPTIME_INCREMENT_SECONDS,
} from "./configs";

const LLAMACPP_LOG_TAIL_LINES = 240;
const LLAMACPP_TPS_STALE_MS = 15_000;
const TOKENS_PER_SECOND_PATTERN = /([0-9]+(?:\.[0-9]+)?)\s*tokens\s+per\s+second/i;
const PROMPT_EVAL_PATTERN = /prompt eval time\s*=/i;
const EVAL_PATTERN = /(^|\s)eval time\s*=/i;

interface LlamacppThroughputSample {
  promptTps: number;
  generationTps: number;
  sampleKey: string;
}

const parseTokensPerSecond = (line: string): number | null => {
  const match = line.match(TOKENS_PER_SECOND_PATTERN);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
};

const parseLlamacppThroughputFromLines = (lines: string[]): LlamacppThroughputSample | null => {
  if (lines.length === 0) return null;

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

  const promptTps = promptLine ? (parseTokensPerSecond(promptLine) ?? 0) : 0;
  const generationTps = evalLine ? (parseTokensPerSecond(evalLine) ?? 0) : 0;
  if (promptTps <= 0 && generationTps <= 0) return null;

  return {
    promptTps,
    generationTps,
    sampleKey: `${promptLine}::${evalLine}`,
  };
};

const findRunningRecipeForProcess = (context: AppContext, current: ProcessInfo): Recipe | null => {
  const recipes = context.stores.recipeStore.list();
  return (
    recipes.find((recipe) =>
      isRecipeRunning(recipe, current, {
        allowCurrentContainsRecipePath: true,
      })
    ) ?? null
  );
};

const scrapeLlamacppThroughput = (
  context: AppContext,
  current: ProcessInfo
): LlamacppThroughputSample | null => {
  const recipe = findRunningRecipeForProcess(context, current);
  const recipeLogPath = recipe ? resolveExistingLogPath(context.config.data_dir, recipe.id) : null;
  const servedName = (current.served_model_name ?? "").toLowerCase();

  let logPath = recipeLogPath;
  if (!logPath) {
    const entries = listLogFiles(context.config.data_dir).filter(
      (entry) => entry.sessionId !== "controller"
    );
    const byName =
      servedName.length > 0
        ? entries.find((entry) => entry.sessionId.toLowerCase().includes(servedName))
        : null;
    logPath = byName?.path ?? entries[0]?.path ?? null;
  }

  if (!logPath) return null;
  const lines = tailFileLines(logPath, LLAMACPP_LOG_TAIL_LINES);
  return parseLlamacppThroughputFromLines(lines);
};

/**
 * Start background metrics collection.
 * @param context - App context.
 * @returns Stop function.
 */
export const startMetricsCollector = (context: AppContext): (() => void) => {
  let running = true;
  let lastVllmMetrics: Record<string, number> = {};
  let lastMetricsTime = 0;
  let lastRuntimeSummaryAt = 0;
  let lastLlamacppSampleAt = 0;
  let lastLlamacppSampleKey = "";
  let lastLlamacppPromptThroughput = 0;
  let lastLlamacppGenerationThroughput = 0;
  let lastEnergySnapshotAt = 0;

  /**
   * Scrape Prometheus metrics from vLLM.
   * @param port - Inference port.
   * @returns Metrics map.
   */
  const scrapeVllmMetrics = async (port: number): Promise<Record<string, number>> => {
    try {
      const response = await fetchLocal(port, "/metrics", {
        timeoutMs: METRICS_HTTP_TIMEOUT_MS,
      });
      if (response.status !== 200) {
        return {};
      }
      const text = await response.text();
      const metrics: Record<string, number> = {};
      for (const line of text.split("\n")) {
        if (line.startsWith("#") || line.trim().length === 0) {
          continue;
        }
        const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\{?[^}]*\}?\s+([\d.eE+-]+)$/);
        if (match) {
          const value = Number(match[2]);
          const metricName = match[1];
          if (!Number.isNaN(value) && metricName) {
            metrics[metricName] = value;
          }
        }
      }
      return metrics;
    } catch {
      return {};
    }
  };

  /**
   * Execute a single metrics collection cycle.
   * @returns Promise resolving after the cycle.
   */
  const collect = async (): Promise<void> => {
    try {
      const current = await context.processManager.findInferenceProcess(
        context.config.inference_port
      );
      const gpuList = getGpuInfo();

      if (current) {
        context.metrics.updateActiveModel(
          current.model_path,
          current.backend,
          current.served_model_name
        );
      } else {
        context.metrics.updateActiveModel();
      }

      context.metrics.updateGpuMetrics(gpuList.map((gpu) => ({ ...gpu })));
      context.metrics.updateSseMetrics(context.eventManager.getStats());

      const lifetimeStore = context.stores.lifetimeMetricsStore;
      const totalPowerWatts = gpuList.reduce((sum, gpu) => sum + gpu.power_draw, 0);
      const energyWh = totalPowerWatts * (5 / 3600);
      lifetimeStore.increment("energy_wh", energyWh);
      lifetimeStore.increment("uptime_seconds", METRICS_LIFETIME_UPTIME_INCREMENT_SECONDS);

      // Record energy snapshot every ~1 hour
      if (Date.now() - lastEnergySnapshotAt >= 3_600_000) {
        lifetimeStore.recordEnergySnapshot(lifetimeStore.get("energy_wh"));
        lastEnergySnapshotAt = Date.now();
      }

      await context.eventManager.publishStatus({
        running: Boolean(current),
        process: current,
        inference_port: context.config.inference_port,
      });
      await context.eventManager.publishGpu(gpuList.map((gpu) => ({ ...gpu })));

      if (Date.now() - lastRuntimeSummaryAt > METRICS_RUNTIME_SUMMARY_INTERVAL_MS) {
        try {
          const runtime = await getSystemRuntimeInfo(context.config);
          const leaseHolder = current
            ? (current.served_model_name ?? current.model_path?.split("/").pop() ?? "inference")
            : null;
          await context.eventManager.publishRuntimeSummary({
            platform: runtime.platform,
            gpu_monitoring: runtime.gpu_monitoring,
            backends: runtime.backends,
            lease: { holder: leaseHolder, since: leaseHolder ? new Date().toISOString() : null },
          });
          lastRuntimeSummaryAt = Date.now();
        } catch (error) {
          context.logger.debug("Runtime summary publish failed", { error: String(error) });
        }
      }

      // Always publish basic metrics (lifetime, power) even when idle
      const lifetimeData = lifetimeStore.getAll();
      const energyKwh = (lifetimeData["energy_wh"] ?? 0) / 1000;
      const persisted = loadPersistedConfig(context.config.data_dir);
      const electricityRate = persisted.electricity_rate ?? 0.11;
      const electricityCurrency = persisted.electricity_currency ?? "USD";
      const totalCost = (energyKwh * electricityRate).toFixed(2);
      const baseMetrics = {
        lifetime_prompt_tokens: lifetimeData["prompt_tokens_total"] ?? 0,
        lifetime_completion_tokens: lifetimeData["completion_tokens_total"] ?? 0,
        lifetime_requests: lifetimeData["requests_total"] ?? 0,
        lifetime_energy_kwh: energyKwh,
        lifetime_uptime_hours: (lifetimeData["uptime_seconds"] ?? 0) / 3600,
        current_power_watts: totalPowerWatts,
        electricity_rate: electricityRate,
        electricity_currency: electricityCurrency,
        total_cost: totalCost,
        kwh_per_million_input: lifetimeData["prompt_tokens_total"]
          ? (lifetimeData["energy_wh"] ?? 0) /
            1000 /
            ((lifetimeData["prompt_tokens_total"] ?? 1) / 1_000_000)
          : null,
        kwh_per_million_output: lifetimeData["completion_tokens_total"]
          ? (lifetimeData["energy_wh"] ?? 0) /
            1000 /
            ((lifetimeData["completion_tokens_total"] ?? 1) / 1_000_000)
          : null,
      };

      if (current) {
        const modelId =
          current.served_model_name ?? current.model_path?.split("/").pop() ?? "unknown";
        let promptThroughput = 0;
        let generationThroughput = 0;
        let runningRequests = 0;
        let pendingRequests = 0;
        let kvCacheUsage = 0;
        let promptTokensTotal = 0;
        let generationTokensTotal = 0;

        if (current.backend === "vllm") {
          const vllmMetrics = await scrapeVllmMetrics(context.config.inference_port);
          const now = Date.now() / 1000;
          const elapsed =
            lastMetricsTime > 0 ? now - lastMetricsTime : METRICS_LIFETIME_UPTIME_INCREMENT_SECONDS;
          if (
            elapsed > 0 &&
            Object.keys(vllmMetrics).length > 0 &&
            Object.keys(lastVllmMetrics).length > 0
          ) {
            const previousPromptTokens = lastVllmMetrics["vllm:prompt_tokens_total"] ?? 0;
            const currentPromptTokens = vllmMetrics["vllm:prompt_tokens_total"] ?? 0;
            const previousGenerationTokens = lastVllmMetrics["vllm:generation_tokens_total"] ?? 0;
            const currentGenerationTokens = vllmMetrics["vllm:generation_tokens_total"] ?? 0;
            if (currentPromptTokens > previousPromptTokens) {
              promptThroughput = (currentPromptTokens - previousPromptTokens) / elapsed;
            }
            if (currentGenerationTokens > previousGenerationTokens) {
              generationThroughput = (currentGenerationTokens - previousGenerationTokens) / elapsed;
            }
          }

          runningRequests = Number(vllmMetrics["vllm:num_requests_running"] ?? 0);
          pendingRequests = Number(vllmMetrics["vllm:num_requests_waiting"] ?? 0);
          kvCacheUsage = vllmMetrics["vllm:kv_cache_usage_perc"] ?? 0;
          promptTokensTotal = Number(vllmMetrics["vllm:prompt_tokens_total"] ?? 0);
          generationTokensTotal = Number(vllmMetrics["vllm:generation_tokens_total"] ?? 0);
          lastVllmMetrics = vllmMetrics;
          lastMetricsTime = now;

          // Update peak metrics with actual observed throughput (not fake benchmark calculations)
          if (generationThroughput > 5) {
            // Only update if we have meaningful throughput (> 5 tok/s to filter noise)
            context.stores.peakMetricsStore.updateIfBetter(
              modelId,
              promptThroughput > 0 ? promptThroughput : undefined,
              generationThroughput,
              undefined // TTFT requires streaming measurement
            );
          }
        } else if (current.backend === "llamacpp") {
          // vLLM counters are unavailable on llama.cpp, so derive throughput from recent llama log output.
          lastVllmMetrics = {};
          lastMetricsTime = 0;
          const sample = scrapeLlamacppThroughput(context, current);
          const isNewSample = Boolean(sample && sample.sampleKey !== lastLlamacppSampleKey);
          if (sample && isNewSample) {
            lastLlamacppSampleAt = Date.now();
            lastLlamacppSampleKey = sample.sampleKey;
            if (sample.promptTps > 0) {
              lastLlamacppPromptThroughput = sample.promptTps;
            }
            if (sample.generationTps > 0) {
              lastLlamacppGenerationThroughput = sample.generationTps;
            }

            context.stores.peakMetricsStore.updateIfBetter(
              modelId,
              sample.promptTps > 0 ? sample.promptTps : undefined,
              sample.generationTps > 0 ? sample.generationTps : undefined,
              undefined
            );
          }

          const isFresh = Date.now() - lastLlamacppSampleAt <= LLAMACPP_TPS_STALE_MS;
          promptThroughput = isFresh ? lastLlamacppPromptThroughput : 0;
          generationThroughput = isFresh ? lastLlamacppGenerationThroughput : 0;
        } else {
          // Unknown/non-vLLM backend: keep lifetime/power metrics and avoid stale backend-specific values.
          lastVllmMetrics = {};
          lastMetricsTime = 0;
          lastLlamacppSampleAt = 0;
          lastLlamacppSampleKey = "";
          lastLlamacppPromptThroughput = 0;
          lastLlamacppGenerationThroughput = 0;
        }

        const peakData = context.stores.peakMetricsStore.get(modelId);

        await context.eventManager.publishMetrics({
          ...baseMetrics,
          running_requests: runningRequests,
          pending_requests: pendingRequests,
          kv_cache_usage: kvCacheUsage,
          prompt_tokens_total: promptTokensTotal,
          generation_tokens_total: generationTokensTotal,
          prompt_throughput: Math.round(promptThroughput * 10) / 10,
          generation_throughput: Math.round(generationThroughput * 10) / 10,
          peak_prefill_tps: peakData?.["prefill_tps"] ?? null,
          peak_generation_tps: peakData?.["generation_tps"] ?? null,
          peak_ttft_ms: peakData?.["ttft_ms"] ?? null,
        });
      } else {
        // No model running - still publish base lifetime metrics
        await context.eventManager.publishMetrics(baseMetrics);
      }
    } catch (error) {
      context.logger.error("Metrics collection error", { error: String(error) });
    }
  };

  const loop = async (): Promise<void> => {
    while (running) {
      await collect();
      await delay(METRICS_COLLECT_INTERVAL_MS);
    }
  };

  void loop();

  return () => {
    running = false;
  };
};
