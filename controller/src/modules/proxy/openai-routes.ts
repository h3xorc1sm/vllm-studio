// CRITICAL
import type { Hono } from "hono";
import { HttpStatus, notFound, serviceUnavailable } from "../../core/errors";
import { buildSseHeaders } from "../../http/sse";
import type { AppContext } from "../../types/context";
import type { Recipe } from "../lifecycle/types";
import {
  createToolCallStream,
  normalizeReasoningAndContentInMessage,
  normalizeToolCallsInMessage,
  normalizeToolRequest,
} from "./tool-call-core";
import { buildInferenceUrl } from "../../services/inference/inference-client";

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

    if (!matchedRecipe && requestedModel && context.config.strict_openai_models) {
      throw notFound(`Model not managed: ${requestedModel}`);
    }

    if (matchedRecipe) {
      const switchResult = await context.lifecycleCoordinator.ensureActive(matchedRecipe, {
        force_evict: false,
      });
      if (switchResult.error) {
        throw serviceUnavailable(switchResult.error);
      }
    }

    const toolsPayload = Array.isArray(parsed["tools"]) ? parsed["tools"] : [];
    const hasTools = toolsPayload.length > 0;
    const useDirectInference = isStreaming && hasTools;
    const masterKey = process.env["LITELLM_MASTER_KEY"] ?? "sk-master";
    const inferenceKey = process.env["INFERENCE_API_KEY"] ?? "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(useDirectInference
        ? inferenceKey
          ? { Authorization: `Bearer ${inferenceKey}` }
          : {}
        : { Authorization: `Bearer ${masterKey}` }),
    };
    const litellmUrl = "http://localhost:4100/v1/chat/completions";
    const inferenceUrl = buildInferenceUrl(context, "/v1/chat/completions");
    const upstreamUrl = useDirectInference ? inferenceUrl : litellmUrl;
    const finalBody = bodyChanged
      ? new TextEncoder().encode(JSON.stringify(parsed)).buffer
      : bodyBuffer;

    if (!isStreaming) {
      const response = await fetch(litellmUrl, { method: "POST", headers, body: finalBody });
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

    const reader = upstreamResponse.body?.getReader();
    if (!reader) {
      throw serviceUnavailable(
        useDirectInference ? "Inference backend unavailable" : "LiteLLM backend unavailable"
      );
    }

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
    });

    return new Response(stream, { headers: buildSseHeaders() });
  });
};
