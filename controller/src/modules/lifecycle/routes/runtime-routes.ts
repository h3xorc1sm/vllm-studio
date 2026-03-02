// CRITICAL
import type { Hono } from "hono";
import type { AppContext } from "../../../types/context";
import { badRequest } from "../../../core/errors";
import { getLlamacppConfigHelp } from "../runtime/llamacpp-runtime";
import { getVllmRuntimeInfo, upgradeVllmRuntime, getVllmConfigHelp } from "../runtime/vllm-runtime";
import {
  getCudaInfo,
  getExllamav3RuntimeInfo,
  getLlamacppRuntimeInfo,
  getSglangRuntimeInfo,
} from "../runtime/runtime-info";
import { getRocmInfo, resolveRocmSmiTool } from "../platform/rocm-info";
import {
  runPlatformUpgrade,
  upgradeLlamacppRuntime,
  upgradeSglangRuntime,
} from "../runtime/runtime-upgrade";
import { Event } from "../../monitoring/event-manager";
import { CONTROLLER_EVENTS } from "../../../contracts/controller-events";

export const registerRuntimeRoutes = (app: Hono, context: AppContext): void => {
  app.get("/runtime/vllm", async (ctx) => {
    const info = await getVllmRuntimeInfo();
    return ctx.json(info);
  });

  app.get("/runtime/vllm/config", async (ctx) => {
    const config = await getVllmConfigHelp();
    return ctx.json(config);
  });

  app.get("/runtime/llamacpp/config", async (ctx) => {
    const config = await getLlamacppConfigHelp(context.config);
    return ctx.json(config);
  });

  app.get("/runtime/sglang", async (ctx) => {
    const info = await getSglangRuntimeInfo(context.config);
    return ctx.json(info);
  });

  app.get("/runtime/llamacpp", async (ctx) => {
    const info = getLlamacppRuntimeInfo(context.config);
    return ctx.json(info);
  });

  app.get("/runtime/exllamav3", async (ctx) => {
    const info = getExllamav3RuntimeInfo(context.config);
    return ctx.json(info);
  });

  app.get("/runtime/cuda", async (ctx) => {
    return ctx.json(getCudaInfo());
  });

  app.get("/runtime/rocm", async (ctx) => {
    const smiTool = resolveRocmSmiTool();
    return ctx.json(getRocmInfo(smiTool));
  });

  app.post("/runtime/sglang/upgrade", async (ctx) => {
    const body = await ctx.req.json().catch(() => ({}));
    // Security: user-supplied commands are ignored; only env-configured or built-in commands are used.
    const parsedArguments = Array.isArray(body?.args) ? body.args : [];
    if (parsedArguments.some((value: unknown) => typeof value !== "string")) {
      throw badRequest("args must be an array of strings");
    }

    const finalResult = await upgradeSglangRuntime(context.config, {
      ...(parsedArguments.length > 0 ? { args: parsedArguments as string[] } : {}),
    });
    await context.eventManager.publish(
      new Event(CONTROLLER_EVENTS.RUNTIME_SGLANG_UPGRADED, {
        success: finalResult.success,
        version: finalResult.version,
        used_command: finalResult.used_command,
      })
    );
    return ctx.json(finalResult);
  });

  app.post("/runtime/llamacpp/upgrade", async (ctx) => {
    const body = await ctx.req.json().catch(() => ({}));
    // Security: user-supplied commands are ignored; only env-configured or built-in commands are used.
    const parsedArguments = Array.isArray(body?.args) ? body.args : [];
    if (parsedArguments.some((value: unknown) => typeof value !== "string")) {
      throw badRequest("args must be an array of strings");
    }

    const result = await upgradeLlamacppRuntime(context.config, {
      ...(parsedArguments.length > 0 ? { args: parsedArguments as string[] } : {}),
    });
    await context.eventManager.publish(
      new Event(CONTROLLER_EVENTS.RUNTIME_LLAMACPP_UPGRADED, {
        success: result.success,
        version: result.version,
        used_command: result.used_command,
      })
    );
    return ctx.json(result);
  });

  app.post("/runtime/cuda/upgrade", async (ctx) => {
    const body = await ctx.req.json().catch(() => ({}));
    // Security: user-supplied commands are ignored; only env-configured or built-in commands are used.
    const parsedArguments = Array.isArray(body?.args) ? body.args : [];
    if (parsedArguments.some((value: unknown) => typeof value !== "string")) {
      throw badRequest("args must be an array of strings");
    }
    const result = runPlatformUpgrade("cuda", {
      ...(parsedArguments.length > 0 ? { args: parsedArguments as string[] } : {}),
    });
    await context.eventManager.publish(
      new Event(CONTROLLER_EVENTS.RUNTIME_CUDA_UPGRADED, {
        success: result.success,
        version: result.version,
        used_command: result.used_command,
      })
    );
    return ctx.json(result);
  });

  app.post("/runtime/rocm/upgrade", async (ctx) => {
    const body = await ctx.req.json().catch(() => ({}));
    // Security: user-supplied commands are ignored; only env-configured or built-in commands are used.
    const parsedArguments = Array.isArray(body?.args) ? body.args : [];
    if (parsedArguments.some((value: unknown) => typeof value !== "string")) {
      throw badRequest("args must be an array of strings");
    }
    const result = runPlatformUpgrade("rocm", {
      ...(parsedArguments.length > 0 ? { args: parsedArguments as string[] } : {}),
    });
    await context.eventManager.publish(
      new Event(CONTROLLER_EVENTS.RUNTIME_ROCM_UPGRADED, {
        success: result.success,
        version: result.version,
        used_command: result.used_command,
      })
    );
    return ctx.json(result);
  });

  app.post("/runtime/vllm/upgrade", async (ctx) => {
    const body = await ctx.req.json().catch(() => ({}));
    if (body && typeof body !== "object") {
      throw badRequest("Invalid payload");
    }
    const preferBundled = body?.prefer_bundled !== false;
    // Security: user-supplied commands are ignored; only env-configured or built-in commands are used.
    const parsedArguments = Array.isArray(body?.args) ? body.args : [];
    const requestedVersion = typeof body?.version === "string" ? body.version.trim() : undefined;
    if (parsedArguments.some((value: unknown) => typeof value !== "string")) {
      throw badRequest("args must be an array of strings");
    }
    const result = await upgradeVllmRuntime({
      preferBundled,
      ...(parsedArguments.length > 0 ? { args: parsedArguments as string[] } : {}),
      ...(requestedVersion ? { version: requestedVersion } : {}),
    });
    await context.eventManager.publish(
      new Event(CONTROLLER_EVENTS.RUNTIME_VLLM_UPGRADED, {
        success: result.success,
        version: result.version,
        used_wheel: result.used_wheel,
      })
    );
    return ctx.json(result);
  });
};
