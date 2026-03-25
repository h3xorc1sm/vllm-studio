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
      if (requestLogsUsage) return ctx.json(requestLogsUsage);

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
