import type { AppContext } from "../../../types/context";
import {
  DAYTONA_PROVIDER,
  DEFAULT_CHAT_PROVIDER,
  parseProviderModel,
  resolveProviderConfig,
  normalizeModelForRequest,
} from "../../../services/provider-routing";

export type ResolvedModelSelection = {
  requestModel: string;
  storedModel: string;
  provider: string;
};

export async function resolveModel(
  context: AppContext,
  session: Record<string, unknown>,
  override?: string,
  overrideProvider?: string
): Promise<ResolvedModelSelection> {
  const parsedOverride = parseProviderModel(typeof override === "string" ? override : "");
  const providerFromOverride = typeof overrideProvider === "string" ? overrideProvider.trim() : "";
  if (parsedOverride.modelId) {
    const provider = providerFromOverride || parsedOverride.provider;
    const storedModel = normalizeModelForRequest(provider, parsedOverride.modelId);
    return {
      requestModel: parsedOverride.modelId,
      provider,
      storedModel,
    };
  }

  const sessionModel = typeof session["model"] === "string" ? session["model"] : undefined;
  const parsedSessionModel = parseProviderModel(sessionModel || "");
  if (parsedSessionModel.modelId) {
    const provider =
      providerFromOverride ||
      (parsedSessionModel.provider ? parsedSessionModel.provider : DEFAULT_CHAT_PROVIDER);
    return {
      requestModel: parsedSessionModel.modelId,
      provider,
      storedModel: normalizeModelForRequest(provider, parsedSessionModel.modelId),
    };
  }

  const current = await context.processManager.findInferenceProcess(context.config.inference_port);
  if (current?.served_model_name) {
    const parsedCurrent = parseProviderModel(current.served_model_name);
    if (parsedCurrent.modelId) {
      return {
        requestModel: parsedCurrent.modelId,
        provider: parsedCurrent.provider || DEFAULT_CHAT_PROVIDER,
        storedModel: normalizeModelForRequest(
          parsedCurrent.provider || DEFAULT_CHAT_PROVIDER,
          parsedCurrent.modelId
        ),
      };
    }
  }

  if (current?.model_path) {
    const parts = current.model_path.split("/");
    const tail = parts[parts.length - 1] ?? "";
    const parsedCurrent = parseProviderModel(tail);
    if (parsedCurrent.modelId) {
      const provider = providerFromOverride || parsedCurrent.provider || DEFAULT_CHAT_PROVIDER;
      return {
        requestModel: parsedCurrent.modelId,
        provider,
        storedModel: normalizeModelForRequest(provider, parsedCurrent.modelId),
      };
    }
  }

  return {
    requestModel: "default",
    provider: DEFAULT_CHAT_PROVIDER,
    storedModel: "default",
  };
}

export function resolveApiKey(context: AppContext, provider = DEFAULT_CHAT_PROVIDER): string {
  if (provider === DAYTONA_PROVIDER) {
    const providerConfig = resolveProviderConfig(provider, {
      daytonaApiUrl: context.config.daytona_api_url,
      daytonaApiKey: context.config.daytona_api_key,
    });
    return providerConfig?.apiKey ?? "none";
  }

  const configuredProvider = resolveProviderConfig(provider, {
    providers: context.config.providers,
  });
  if (configuredProvider) {
    return configuredProvider.apiKey;
  }

  return context.config.api_key ?? process.env["OPENAI_API_KEY"] ?? "none";
}
