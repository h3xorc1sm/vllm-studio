// CRITICAL
import type { Hono } from "hono";
import type { AppContext } from "../../../types/context";
import type { Recipe } from "../types";
import { delay } from "../../../core/async";
import { badRequest, notFound } from "../../../core/errors";
import { parseRecipe } from "../recipes/recipe-serializer";
import { Event } from "../../monitoring/event-manager";
import { CONTROLLER_EVENTS } from "../../../contracts/controller-events";
import { fetchInference } from "../../../services/inference/inference-client";
import { isRecipeRunning } from "../recipes/recipe-matching";

/**
 * Register lifecycle routes.
 * @param app - Hono app.
 * @param context - App context.
 */
export const registerLifecycleRoutes = (app: Hono, context: AppContext): void => {
  const serializeRecipeDetail = (recipe: Recipe): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      ...recipe,
      tp: recipe.tensor_parallel_size,
      pp: recipe.pipeline_parallel_size,
    };
    delete payload["tensor_parallel_size"];
    delete payload["pipeline_parallel_size"];
    return payload;
  };

  app.get("/recipes", async (ctx) => {
    const recipes = context.stores.recipeStore.list();
    const current = await context.processManager.findInferenceProcess(
      context.config.inference_port
    );
    const launchingId = context.launchState.getLaunchingRecipeId();
    const result = recipes.map((recipe) => {
      let status = "stopped";
      if (launchingId === recipe.id) {
        status = "starting";
      }
      if (current && isRecipeRunning(recipe, current)) {
        status = "running";
      }
      return { ...recipe, status };
    });
    return ctx.json(result);
  });

  app.get("/recipes/:recipeId", async (ctx) => {
    const recipeId = ctx.req.param("recipeId");
    const recipe = context.stores.recipeStore.get(recipeId);
    if (!recipe) {
      throw notFound("Recipe not found");
    }
    return ctx.json(serializeRecipeDetail(recipe));
  });

  app.post("/recipes", async (ctx) => {
    const body = await ctx.req.json();
    try {
      const recipe = parseRecipe(body);
      context.stores.recipeStore.save(recipe);
      await context.eventManager.publish(new Event(CONTROLLER_EVENTS.RECIPE_CREATED, { recipe }));
      return ctx.json({ success: true, id: recipe.id });
    } catch (error) {
      throw badRequest(String(error));
    }
  });

  app.put("/recipes/:recipeId", async (ctx) => {
    const recipeId = ctx.req.param("recipeId");
    const body = await ctx.req.json();
    try {
      const recipe = parseRecipe({ ...body, id: recipeId });
      context.stores.recipeStore.save(recipe);
      await context.eventManager.publish(new Event(CONTROLLER_EVENTS.RECIPE_UPDATED, { recipe }));
      return ctx.json({ success: true, id: recipe.id });
    } catch (error) {
      throw badRequest(String(error));
    }
  });

  app.delete("/recipes/:recipeId", async (ctx) => {
    const recipeId = ctx.req.param("recipeId");
    const deleted = context.stores.recipeStore.delete(recipeId);
    if (!deleted) {
      throw notFound("Recipe not found");
    }
    await context.eventManager.publish(
      new Event(CONTROLLER_EVENTS.RECIPE_DELETED, { recipe_id: recipeId })
    );
    return ctx.json({ success: true });
  });

  app.post("/launch/:recipeId", async (ctx) => {
    const recipeId = ctx.req.param("recipeId");
    const recipe = context.stores.recipeStore.get(recipeId);
    if (!recipe) {
      throw notFound("Recipe not found");
    }
    const launch = await context.lifecycleCoordinator.launchRecipe(recipe);
    return ctx.json(launch);
  });

  app.post("/launch/:recipeId/cancel", async (ctx) => {
    const recipeId = ctx.req.param("recipeId");
    const result = await context.lifecycleCoordinator.cancelLaunch(recipeId);
    if (!result.success) {
      throw notFound(result.message);
    }
    return ctx.json(result);
  });

  app.post("/evict", async (ctx) => {
    const force = Boolean(ctx.req.query("force"));
    const result = await context.lifecycleCoordinator.evict(force);
    return ctx.json(result);
  });

  app.get("/wait-ready", async (ctx) => {
    const timeout = Number(ctx.req.query("timeout") ?? 300);
    const start = Date.now();
    while (Date.now() - start < timeout * 1000) {
      try {
        const response = await fetchInference(context, "/health", { timeoutMs: 5000 });
        if (response.status === 200) {
          return ctx.json({ ready: true, elapsed: Math.floor((Date.now() - start) / 1000) });
        }
      } catch {
        // Ignore fetch errors, retry after delay
      }
      await delay(2000);
    }
    return ctx.json({ ready: false, elapsed: timeout, error: "Timeout waiting for backend" });
  });
};
