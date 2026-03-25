// CRITICAL
import type { Hono } from "hono";
import { performance } from "node:perf_hooks";
import type { AppContext } from "../../types/context";
import { getGpuInfo } from "../lifecycle/platform/gpu";
import { fetchInference } from "../../services/inference/inference-client";
import { loadPersistedConfig } from "../../config/persisted-config";

/**
 * Register monitoring routes.
 * @param app - Hono app.
 * @param context - App context.
 */
export const registerMonitoringRoutes = (app: Hono, context: AppContext): void => {
  app.get("/metrics", async (_ctx) => {
    const current = await context.processManager.findInferenceProcess(
      context.config.inference_port
    );
    if (current) {
      context.metrics.updateActiveModel(
        current.model_path,
        current.backend,
        current.served_model_name
      );
    } else {
      context.metrics.updateActiveModel();
    }

    const gpus = getGpuInfo();
    context.metrics.updateGpuMetrics(gpus.map((gpu) => ({ ...gpu })));
    context.metrics.updateSseMetrics(context.eventManager.getStats());

    const content = await context.metricsRegistry.getMetrics();
    return new Response(content, {
      headers: { "Content-Type": context.metricsRegistry.contentType },
    });
  });

  app.get("/peak-metrics", async (ctx) => {
    const modelId = ctx.req.query("model_id");
    if (modelId) {
      const result = context.stores.peakMetricsStore.get(modelId);
      return ctx.json(result ?? { error: "No metrics for this model" });
    }
    return ctx.json({ metrics: context.stores.peakMetricsStore.getAll() });
  });

  app.get("/lifetime-metrics", async (ctx) => {
    const period = ctx.req.query("period");
    const data = context.stores.lifetimeMetricsStore.getAll();
    const persisted = loadPersistedConfig(context.config.data_dir);
    const electricityRate = persisted.electricity_rate ?? 0.11;
    const electricityCurrency = persisted.electricity_currency ?? "USD";

    let energyKwh = (data["energy_wh"] ?? 0) / 1000;
    let promptTokens = data["prompt_tokens_total"] ?? 0;
    let completionTokens = data["completion_tokens_total"] ?? 0;
    let requestCount = data["requests_total"] ?? 0;

    // Period filtering using request_logs for tokens/requests and energy_snapshots for energy
    if (period && period !== "all") {
      const PERIOD_OFFSETS: Record<string, string> = {
        d: "-24 hours",
        w: "-7 days",
        m: "-30 days",
        y: "-365 days",
      };
      const offset = PERIOD_OFFSETS[period];
      if (offset) {
        const logs = context.stores.lifetimeMetricsStore.getRequestLogs(period);
        promptTokens = logs.rows.reduce((sum, r) => sum + (r.prompt_tokens ?? 0), 0);
        completionTokens = logs.rows.reduce((sum, r) => sum + (r.completion_tokens ?? 0), 0);
        requestCount = logs.rows.length;

        const currentEnergy = context.stores.lifetimeMetricsStore.getCurrentEnergy();
        const snapshot = context.stores.lifetimeMetricsStore.getEnergyBefore(
          new Date(Date.now() + new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace("T", " "),
        );
        const snapshotEnergy = snapshot?.energy_wh ?? 0;
        energyKwh = Math.max(0, (currentEnergy - snapshotEnergy)) / 1000;
      }
    }

    const tokens = promptTokens + completionTokens;
    const uptimeHours = (data["uptime_seconds"] ?? 0) / 3600;
    const kwhPerMillion = tokens > 0 ? energyKwh / (tokens / 1_000_000) : 0;
    const gpus = getGpuInfo();
    const currentPower = gpus.reduce((sum, gpu) => sum + gpu.power_draw, 0);
    const totalCost = (energyKwh * electricityRate).toFixed(2);

    return ctx.json({
      tokens_total: Math.floor(tokens),
      requests_total: Math.floor(requestCount),
      energy_wh: energyKwh * 1000,
      energy_kwh: energyKwh,
      uptime_seconds: data["uptime_seconds"] ?? 0,
      uptime_hours: uptimeHours,
      first_started_at: data["first_started_at"] ?? 0,
      kwh_per_million_tokens: kwhPerMillion,
      current_power_watts: currentPower,
      electricity_rate: electricityRate,
      electricity_currency: electricityCurrency,
      total_cost: totalCost,
    });
  });

  app.get("/usage/cost", async (ctx) => {
    const period = ctx.req.query("period");
    const data = context.stores.lifetimeMetricsStore.getAll();
    const gpus = getGpuInfo();
    const currentPower = gpus.reduce((sum, gpu) => sum + gpu.power_draw, 0);

    const persisted = loadPersistedConfig(context.config.data_dir);
    const electricityRate = persisted.electricity_rate ?? 0.11;
    const electricityCurrency = persisted.electricity_currency ?? "USD";

    let energyKwh = (data["energy_wh"] ?? 0) / 1000;

    if (period && period !== "all") {
      const PERIOD_OFFSETS: Record<string, string> = {
        d: "-24 hours",
        w: "-7 days",
        m: "-30 days",
        y: "-365 days",
      };
      const offset = PERIOD_OFFSETS[period];
      if (offset) {
        const currentEnergy = context.stores.lifetimeMetricsStore.getCurrentEnergy();
        const snapshot = context.stores.lifetimeMetricsStore.getEnergyBefore(
          new Date(Date.now() + new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace("T", " "),
        );
        const snapshotEnergy = snapshot?.energy_wh ?? 0;
        energyKwh = Math.max(0, (currentEnergy - snapshotEnergy)) / 1000;
      }
    }

    const totalCost = (energyKwh * electricityRate).toFixed(2);
    const hourlyCost = ((currentPower / 1000) * electricityRate).toFixed(2);

    return ctx.json({
      total_cost: totalCost,
      electricity_rate: electricityRate,
      electricity_currency: electricityCurrency,
      lifetime_energy_kwh: energyKwh,
      current_power_watts: currentPower,
      estimated_hourly_cost: hourlyCost,
    });
  });

  app.post("/benchmark", async (ctx) => {
    const promptTokens = Number(ctx.req.query("prompt_tokens") ?? 1000);
    const maxTokens = Number(ctx.req.query("max_tokens") ?? 100);
    const current = await context.processManager.findInferenceProcess(
      context.config.inference_port
    );
    if (!current) {
      return ctx.json({ error: "No model running" });
    }
    const modelId = current.served_model_name ?? current.model_path?.split("/").pop() ?? "unknown";
    const prompt = `Please count: ${Array.from({ length: Math.floor(promptTokens / 2) })
      .map((_, index) => index.toString())
      .join(" ")}`;

    try {
      const start = performance.now();
      const response = await fetchInference(context, "/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          stream: false,
        }),
      });
      const totalTime = (performance.now() - start) / 1000;
      if (!response.ok) {
        return ctx.json({ error: `Request failed: ${response.status}` });
      }
      const data = (await response.json()) as { usage?: Record<string, number> };
      const usage = data.usage ?? {};
      const promptTokensActual = usage["prompt_tokens"] ?? 0;
      const completionTokens = usage["completion_tokens"] ?? 0;

      if (completionTokens > 0 && promptTokensActual > 0) {
        // Calculate generation throughput from total time
        // Note: This includes prefill time so it's a conservative estimate
        // Real-time metrics collector tracks actual generation throughput more accurately
        const generationTps = completionTokens / totalTime;

        // Don't fake prefill - it requires TTFT measurement from streaming
        const result = context.stores.peakMetricsStore.updateIfBetter(
          modelId,
          undefined, // prefill requires proper TTFT measurement
          generationTps,
          undefined // TTFT requires streaming measurement
        );
        context.stores.peakMetricsStore.addTokens(modelId, completionTokens, 1);

        return ctx.json({
          success: true,
          model_id: modelId,
          benchmark: {
            prompt_tokens: promptTokensActual,
            completion_tokens: completionTokens,
            total_time_s: Math.round(totalTime * 100) / 100,
            generation_tps: Math.round(generationTps * 10) / 10,
          },
          peak_metrics: result,
        });
      }
      return ctx.json({ error: "No tokens in response" });
    } catch (error) {
      return ctx.json({ error: String(error) });
    }
  });
};
