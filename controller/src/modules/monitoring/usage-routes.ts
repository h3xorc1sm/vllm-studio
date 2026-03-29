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
        // Supplement cache stats from vLLM Prometheus metrics if per-request data is all zeros
        const cache = requestLogsUsage["cache"] as { hit_rate: number; hit_tokens: number; miss_tokens: number; hits: number; misses: number } | undefined;
        if (cache && cache.hit_tokens === 0) {
          const prefixQueries = context.stores.lifetimeMetricsStore.get("prefix_cache_queries_total");
          const prefixHits = context.stores.lifetimeMetricsStore.get("prefix_cache_hits_total");
          if (prefixQueries > 0) {
            cache.hit_tokens = Math.round(prefixHits);
            cache.miss_tokens = Math.round(prefixQueries - prefixHits);
            cache.hit_rate = Math.round((prefixHits / prefixQueries) * 10000) / 100;
            cache.hits = prefixHits > 0 ? 1 : 0;
            cache.misses = (prefixQueries - prefixHits) > 0 ? 1 : 0;
          }
        }
        return ctx.json(requestLogsUsage);
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
