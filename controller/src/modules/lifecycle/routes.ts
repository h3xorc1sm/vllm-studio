import type { Hono } from "hono";
import type { AppContext } from "../../types/context";
import { registerSystemRoutes } from "./routes/system-routes";
import { registerLifecycleRoutes } from "./routes/lifecycle-routes";
import { registerRuntimeRoutes } from "./routes/runtime-routes";

/**
 * Register all lifecycle module routes (system, lifecycle, runtime).
 * @param app - Hono app.
 * @param context - App context.
 */
export const registerAllLifecycleRoutes = (app: Hono, context: AppContext): void => {
  registerSystemRoutes(app, context);
  registerLifecycleRoutes(app, context);
  registerRuntimeRoutes(app, context);
};
