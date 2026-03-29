// CRITICAL
import type { Hono } from "hono";
import type { AppContext } from "../../types/context";
import { getUsageFromChatDatabase } from "./usage/chat-database";
import { getUsageFromRequestLogs } from "./usage/sqlite-request-logs";
import { emptyResponse } from "./usage/usage-utilities";

/**
 * Register usage analytics routes.
 * Tries request_logs (new SQLite source) first, then chat DB.
 * Falls back to empty data if no sources are available.
 * Supports ?period=d|w|m|y|all query parameter for time filtering.
 * @param app - Hono app.
 * @param context - App context.
 */
export const registerUsageRoutes = (app: Hono, context: AppContext): void => {
  app.get("/usage", async (ctx) => {
    try {
      const period = ctx.req.query("period");

      // Try new request_logs source first (captures all requests including streaming)
      const requestLogsUsage = getUsageFromRequestLogs(context.config.db_path, period);
      if (requestLogsUsage) {
        // Supplement from usage_hourly buckets (period-filtered, no vLLM dependency)
        const hourlyData = context.stores.lifetimeMetricsStore.getUsageHourly(period);
        if (hourlyData) {
          const totals = requestLogsUsage["totals"] as {
            total_tokens: number;
            prompt_tokens: number;
            completion_tokens: number;
          } | undefined;
          if (totals && (hourlyData.prompt_tokens > 0 || hourlyData.completion_tokens > 0)) {
            totals.prompt_tokens = hourlyData.prompt_tokens;
            totals.completion_tokens = hourlyData.completion_tokens;
            totals.total_tokens = hourlyData.prompt_tokens + hourlyData.completion_tokens;
          }

          const cache = requestLogsUsage["cache"] as {
            hit_rate: number;
            hit_tokens: number;
            miss_tokens: number;
            hits: number;
            misses: number;
          } | undefined;
          if (cache && cache.hit_tokens === 0 && hourlyData.cache_queries > 0) {
            cache.hit_tokens = hourlyData.cache_hits;
            cache.miss_tokens = hourlyData.cache_queries - hourlyData.cache_hits;
            cache.hit_rate =
              Math.round((hourlyData.cache_hits / hourlyData.cache_queries) * 10000) / 100;
            cache.hits = hourlyData.cache_hits > 0 ? 1 : 0;
            cache.misses =
              (hourlyData.cache_queries - hourlyData.cache_hits) > 0 ? 1 : 0;
          }
        }

        return ctx.json(requestLogsUsage);
      }

      // Fallback: usage_hourly buckets alone (no request_logs data)
      const hourlyData = context.stores.lifetimeMetricsStore.getUsageHourly(period);
      if (hourlyData) {
        const totalTokens = hourlyData.prompt_tokens + hourlyData.completion_tokens;
        const cacheHitRate =
          hourlyData.cache_queries > 0
            ? Math.round((hourlyData.cache_hits / hourlyData.cache_queries) * 10000) / 100
            : 0;
        return ctx.json({
          ...emptyResponse(),
          totals: {
            total_tokens: totalTokens,
            prompt_tokens: hourlyData.prompt_tokens,
            completion_tokens: hourlyData.completion_tokens,
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            success_rate: 0,
            unique_sessions: 0,
            unique_users: 0,
          },
          cache: {
            hits: hourlyData.cache_hits > 0 ? 1 : 0,
            misses: (hourlyData.cache_queries - hourlyData.cache_hits) > 0 ? 1 : 0,
            hit_tokens: hourlyData.cache_hits,
            miss_tokens: hourlyData.cache_queries - hourlyData.cache_hits,
            hit_rate: cacheHitRate,
          },
        });
      }

      // Fallback to chat database
      const chatUsage = getUsageFromChatDatabase(context.config.data_dir);
      if (chatUsage) return ctx.json(chatUsage);

      return ctx.json(emptyResponse());
    } catch (error) {
      console.error("[Usage] Error fetching usage stats:", error);
      try {
        const chatUsage = getUsageFromChatDatabase(context.config.data_dir);
        if (chatUsage) return ctx.json(chatUsage);
      } catch (fallbackError) {
        console.error("[Usage] Fallback also failed:", fallbackError);
      }
      return ctx.json(emptyResponse());
    }
  });
};
