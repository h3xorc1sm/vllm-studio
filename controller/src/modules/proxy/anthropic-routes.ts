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
  createAnthropicStream,
  translateRequestToOpenAI,
  translateResponseToAnthropic,
} from "./anthropic-adapter";
import type { AnthropicRequest } from "./anthropic-adapter";

export const registerAnthropicRoutes = (app: Hono, context: AppContext): void => {
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

  app.post("/v1/messages", async (ctx) => {
    // Parse request body
    let bodyBuffer: ArrayBuffer;
    try {
      bodyBuffer = await ctx.req.arrayBuffer();
    } catch {
      throw new HttpStatus(400, "Invalid request body");
    }

    let anthropicReq: AnthropicRequest;
    try {
      const bodyText = new TextDecoder().decode(bodyBuffer);
      anthropicReq = JSON.parse(bodyText) as AnthropicRequest;
    } catch {
      throw new HttpStatus(400, "Invalid JSON body");
    }

    // Validate required fields
    if (!anthropicReq.model) {
      throw new HttpStatus(400, "Missing required field: model");
    }
    if (anthropicReq.max_tokens === undefined || anthropicReq.max_tokens === null) {
      throw new HttpStatus(400, "Missing required field: max_tokens");
    }

    const requestedModel = anthropicReq.model;
    const isStreaming = Boolean(anthropicReq.stream);

    // Model lookup
    const matchedRecipe = findRecipeByModel(requestedModel);

    const providerModel = parseProviderModel(requestedModel);
    const requestProvider = providerModel.provider;
    const providerRouting =
      requestProvider !== DEFAULT_CHAT_PROVIDER
        ? resolveProviderConfig(requestProvider, {
            daytonaApiUrl: context.config.daytona_api_url,
            daytonaApiKey: context.config.daytona_api_key,
            providers: context.config.providers,
          })
        : null;

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

    // Activation policy
    if (matchedRecipe) {
      const current = await context.processManager.findInferenceProcess(context.config.inference_port);
      const policy = context.config.openai_model_activation_policy ?? "load_if_idle";
      await ensureRecipeIsActive(matchedRecipe, current, policy);
    }

    // Translate to OpenAI format
    const openaiReq = translateRequestToOpenAI(anthropicReq);

    // Override model with canonical name or provider model ID
    if (matchedRecipe) {
      const canonical = matchedRecipe.served_model_name ?? matchedRecipe.id;
      if (canonical) openaiReq["model"] = canonical;
    } else if (providerRouting && requestedModel) {
      openaiReq["model"] = providerModel.modelId;
    }

    // Build upstream URL
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

    const requestBody = new TextEncoder().encode(JSON.stringify(openaiReq)).buffer;

    // ── Non-streaming ──
    if (!isStreaming) {
      const startTime = new Date();
      const response = await fetch(upstreamUrl, { method: "POST", headers, body: requestBody });
      const endTime = new Date();
      const result = (await response.json()) as Record<string, unknown>;

      // Track metrics
      const usage = result["usage"] as Record<string, unknown> | undefined;
      if (usage) {
        const promptTokens = Number(usage["prompt_tokens"] ?? 0);
        const completionTokens = Number(usage["completion_tokens"] ?? 0);
        const promptDetails = usage["prompt_tokens_details"] as Record<string, unknown> | undefined;
        const rawCached = promptDetails?.["cached_tokens"];
        const cachedTokens = rawCached != null ? Number(rawCached) : undefined;
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
          cached_tokens: cachedTokens,
        });
      }

      const anthropicResp = translateResponseToAnthropic(
        result,
        requestedModel,
        anthropicReq.stop_sequences
      );

      return ctx.json(anthropicResp, { status: response.status });
    }

    // ── Streaming ──
    const streamStartTime = new Date();

    const upstreamResponse = await fetch(upstreamUrl, { method: "POST", headers, body: requestBody });
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

    // Track TTFT
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

    const stream = createAnthropicStream(reader, requestedModel, anthropicReq.stop_sequences, (usage) => {
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
        cached_tokens: usage.cached_tokens,
      });
    });

    return new Response(stream, { headers: buildSseHeaders() });
  });
};
