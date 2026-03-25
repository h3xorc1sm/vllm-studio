// CRITICAL
import type { Hono } from "hono";
import { HttpStatus, notFound, serviceUnavailable } from "../../core/errors";
import { isRecipeRunning } from "../lifecycle/recipes/recipe-matching";
import { buildSseHeaders } from "../../http/sse";
import type { AppContext } from "../../types/context";
import type { ProcessInfo, Recipe } from "../lifecycle/types";
import { buildInferenceUrl } from "../../services/inference/inference-client";
import {
  DAYTONA_PROVIDER,
  DEFAULT_CHAT_PROVIDER,
  parseProviderModel,
  resolveProviderConfig,
} from "../../services/provider-routing";
import {
  createToolCallStream,
  normalizeReasoningAndContentInMessage,
  normalizeToolCallsInMessage,
  normalizeToolRequest,
} from "./tool-call-core";

export const registerOpenAIRoutes = (app: Hono, context: AppContext): void => {
  const findRecipeByModel = (modelName: string): Recipe | null => {
    const lower = modelName.toLowerCase();
    for (const recipe of context.stores.recipeStore.list()) {
      const served = (recipe.served_model_name ?? "").toLowerCase();
      if (served === lower || recipe.id.toLowerCase() === lower) {
        return recipe;
      }
      const name = (recipe.name ?? "").toLowerCase();
      if (name && name === lower) {
        return recipe;
      }
    }
    return null;
  };

  const findRecipeForProcess = (current: ProcessInfo): Recipe | null => {
    for (const recipe of context.stores.recipeStore.list()) {
      if (isRecipeRunning(recipe, current, { allowEitherPathContains: true })) {
        return recipe;
      }
    }
    return null;
  };

  const ensureRecipeIsActive = async (
    recipe: Recipe,
    current: ProcessInfo | null,
    policy: "load_if_idle" | "switch_on_request"
  ): Promise<void> => {
    if (current && !isRecipeRunning(recipe, current, { allowEitherPathContains: true })) {
      if (policy === "switch_on_request") {
        const switchResult = await context.lifecycleCoordinator.ensureActive(recipe, {
          force_evict: false,
        });
        if (switchResult.error) {
          throw serviceUnavailable(switchResult.error);
        }
      }
      return;
    }

    const switchResult = await context.lifecycleCoordinator.ensureActive(recipe, {
      force_evict: false,
    });
    if (switchResult.error) {
      throw serviceUnavailable(switchResult.error);
    }
  };

  const applyLoadIfIdleModelRewrite = (
    parsedBody: Record<string, unknown>,
    current: ProcessInfo | null
  ): boolean => {
    if (!current) {
      return false;
    }

    const runningRecipe = findRecipeForProcess(current);
    if (!runningRecipe) {
      return false;
    }

    const activeModel = runningRecipe.served_model_name ?? runningRecipe.id;
    if (!activeModel) {
      return false;
    }

    parsedBody["model"] = activeModel;
    return true;
  };

  app.post("/v1/chat/completions", async (ctx) => {
    let bodyBuffer: ArrayBuffer;
    try {
      bodyBuffer = await ctx.req.arrayBuffer();
    } catch {
      throw new HttpStatus(400, "Invalid request body");
    }

    let parsed: Record<string, unknown> = {};
    let requestedModel: string | null = null;
    let matchedRecipe: Recipe | null = null;
    let isStreaming = false;
    let bodyChanged = false;

    try {
      const bodyText = new TextDecoder().decode(bodyBuffer);
      parsed = JSON.parse(bodyText) as Record<string, unknown>;
      normalizeToolRequest(parsed);
      if (typeof parsed["model"] === "string") {
        requestedModel = parsed["model"];
        matchedRecipe = findRecipeByModel(requestedModel);
        if (matchedRecipe) {
          const canonical = matchedRecipe.served_model_name ?? matchedRecipe.id;
          if (canonical && canonical !== requestedModel) {
            parsed["model"] = canonical;
            requestedModel = canonical;
            bodyChanged = true;
          }
        }
      }
      if (parsed["functions"] || parsed["tools"] !== undefined) {
        bodyChanged = true;
      }
      isStreaming = Boolean(parsed["stream"]);
    } catch {
      throw new HttpStatus(400, "Invalid JSON body");
    }

    const providerModel = requestedModel
      ? parseProviderModel(requestedModel)
      : { provider: DEFAULT_CHAT_PROVIDER, modelId: "" };
    const requestProvider = providerModel.provider;
    const providerRouting =
      requestProvider !== DEFAULT_CHAT_PROVIDER
        ? resolveProviderConfig(requestProvider, {
            daytonaApiUrl: context.config.daytona_api_url,
            daytonaApiKey: context.config.daytona_api_key,
            providers: context.config.providers,
          })
        : null;

    if (providerRouting && requestedModel) {
      parsed["model"] = providerModel.modelId;
      bodyChanged = true;
    }

    if (
      !matchedRecipe &&
      requestProvider === DEFAULT_CHAT_PROVIDER &&
      requestedModel &&
      context.config.strict_openai_models
    ) {
      throw notFound(`Model not managed: ${requestedModel}`);
    }

    if (!providerRouting && requestProvider === DAYTONA_PROVIDER) {
      throw new HttpStatus(400, "Missing Daytona provider credentials");
    }

    if (matchedRecipe) {
      const current = await context.processManager.findInferenceProcess(context.config.inference_port);
      const policy = context.config.openai_model_activation_policy ?? "load_if_idle";
      const isMismatchedActive = Boolean(
        current && !isRecipeRunning(matchedRecipe, current, { allowEitherPathContains: true })
      );

      if (isMismatchedActive && policy === "load_if_idle") {
        if (applyLoadIfIdleModelRewrite(parsed, current)) {
          bodyChanged = true;
          requestedModel = typeof parsed["model"] === "string" ? parsed["model"] : requestedModel;
        }
      } else {
        await ensureRecipeIsActive(matchedRecipe, current, policy);
      }
    }

    const upstreamUrl =
      providerRouting && requestedModel
        ? `${providerRouting.baseUrl.replace(/\/+$/, "")}/v1/chat/completions`
        : buildInferenceUrl(context, "/v1/chat/completions");
    const inferenceKey = process.env["INFERENCE_API_KEY"] ?? "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(providerRouting
        ? { Authorization: `Bearer ${providerRouting.apiKey}` }
        : inferenceKey
          ? { Authorization: `Bearer ${inferenceKey}` }
          : {}),
    };
    const finalBody = bodyChanged
      ? new TextEncoder().encode(JSON.stringify(parsed)).buffer
      : bodyBuffer;

    if (!isStreaming) {
      const startTime = new Date();
      const response = await fetch(upstreamUrl, { method: "POST", headers, body: finalBody });
      const endTime = new Date();
      const result = (await response.json()) as Record<string, unknown>;

      const usage = result["usage"] as Record<string, number> | undefined;
      if (usage) {
        const promptTokens = usage["prompt_tokens"] ?? 0;
        const completionTokens = usage["completion_tokens"] ?? 0;
        if (promptTokens > 0) {
          context.stores.lifetimeMetricsStore.addPromptTokens(promptTokens);
          context.stores.lifetimeMetricsStore.addTokens(promptTokens);
        }
        if (completionTokens > 0) {
          context.stores.lifetimeMetricsStore.addCompletionTokens(completionTokens);
          context.stores.lifetimeMetricsStore.addTokens(completionTokens);
        }
        if (promptTokens > 0 || completionTokens > 0) {
          context.stores.lifetimeMetricsStore.addRequests(1);
        }

        context.stores.lifetimeMetricsStore.insertRequestLog({
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          model: requestedModel ?? "unknown",
          status: response.ok ? "success" : "error",
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
          latency_ms: endTime.getTime() - startTime.getTime(),
          ttft_ms: null,
          is_streaming: false,
        });
      }

      const choices = result["choices"];
      if (Array.isArray(choices)) {
        for (const choice of choices) {
          const choiceRecord = choice as Record<string, unknown>;
          const message = choiceRecord["message"] as Record<string, unknown> | undefined;
          if (!message) continue;
          // 1) If the backend emitted tool-call XML, extract `tool_calls` before stripping it.
          if (normalizeToolCallsInMessage(message)) choiceRecord["finish_reason"] = "tool_calls";
          // 2) Move <think>...</think> to `reasoning_content` and strip tool-call XML wrappers from visible content.
          normalizeReasoningAndContentInMessage(message);
        }
      }

      return ctx.json(result, { status: response.status });
    }

    const streamStartTime = new Date();

    const upstreamResponse = await fetch(upstreamUrl, { method: "POST", headers, body: finalBody });
    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text();
      return new Response(errorText, {
        status: upstreamResponse.status,
        headers: {
          "Content-Type": upstreamResponse.headers.get("Content-Type") ?? "application/json",
        },
      });
    }

    const rawReader = upstreamResponse.body?.getReader();
    if (!rawReader) {
      throw serviceUnavailable(
        providerRouting
          ? `${requestProvider} backend unavailable`
          : "Inference backend unavailable"
      );
    }

    // Track TTFT via wrapped reader
    let firstDataTime: Date | null = null;
    const wrappedReader = new ReadableStream<Uint8Array>({
      async start(controller) {
        while (true) {
          const { done, value } = await rawReader.read();
          if (done) {
            controller.close();
            break;
          }
          if (!firstDataTime) firstDataTime = new Date();
          controller.enqueue(value);
        }
      },
    });
    const reader = wrappedReader.getReader();

    const stream = createToolCallStream(reader, (usage) => {
      if (usage.prompt_tokens > 0) {
        context.stores.lifetimeMetricsStore.addPromptTokens(usage.prompt_tokens);
        context.stores.lifetimeMetricsStore.addTokens(usage.prompt_tokens);
      }
      if (usage.completion_tokens > 0) {
        context.stores.lifetimeMetricsStore.addCompletionTokens(usage.completion_tokens);
        context.stores.lifetimeMetricsStore.addTokens(usage.completion_tokens);
      }
      if (usage.prompt_tokens > 0 || usage.completion_tokens > 0) {
        context.stores.lifetimeMetricsStore.addRequests(1);
      }

      context.stores.lifetimeMetricsStore.insertRequestLog({
        start_time: streamStartTime.toISOString(),
        end_time: new Date().toISOString(),
        model: requestedModel ?? "unknown",
        status: "success",
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.prompt_tokens + usage.completion_tokens,
        latency_ms: Date.now() - streamStartTime.getTime(),
        ttft_ms: firstDataTime ? firstDataTime.getTime() - streamStartTime.getTime() : null,
        is_streaming: true,
      });
    });

    return new Response(stream, { headers: buildSseHeaders() });
  });
};
