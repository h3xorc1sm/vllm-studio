// CRITICAL
import type { ProviderConfig } from "../config/persisted-config";

export const DAYTONA_PROVIDER = "daytona";
export const DEFAULT_CHAT_PROVIDER = "openai";
const DEFAULT_DAYTONA_API_URL = "https://app.daytona.io/api";

export const WELL_KNOWN_PROVIDERS: Record<string, { name: string; baseUrl: string }> = {
  openai: { name: "OpenAI", baseUrl: "https://api.openai.com" },
  anthropic: { name: "Anthropic", baseUrl: "https://api.anthropic.com" },
};

export interface ParsedProviderModel {
  provider: string;
  modelId: string;
}

export interface ProviderRouteConfig {
  baseUrl: string;
  apiKey: string;
}

export interface ControllerProviderRoutingConfig {
  daytonaApiUrl?: string | undefined;
  daytonaApiKey?: string | undefined;
  providers?: ProviderConfig[];
}

const resolveEnvValue = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const parseProviderModel = (rawModel: string): ParsedProviderModel => {
  const trimmed = rawModel.trim();
  if (!trimmed) {
    return { provider: DEFAULT_CHAT_PROVIDER, modelId: "" };
  }

  const delimiter = trimmed.indexOf("/");
  if (delimiter > 0 && delimiter < trimmed.length - 1) {
    const provider = trimmed.slice(0, delimiter).trim();
    const modelId = trimmed.slice(delimiter + 1).trim();
    if (modelId.length > 0) {
      return { provider: provider || DEFAULT_CHAT_PROVIDER, modelId };
    }
  }

  return { provider: DEFAULT_CHAT_PROVIDER, modelId: trimmed };
};

export const normalizeModelForRequest = (provider: string, modelId: string): string =>
  provider === DEFAULT_CHAT_PROVIDER ? modelId : `${provider}/${modelId}`;

export const resolveDaytonaProviderConfig = (
  config: ControllerProviderRoutingConfig = {}
): ProviderRouteConfig | null => {
  const baseUrl =
    resolveEnvValue(config.daytonaApiUrl) ??
    resolveEnvValue(process.env["VLLM_STUDIO_DAYTONA_API_URL"]) ??
    DEFAULT_DAYTONA_API_URL;

  const apiKey =
    resolveEnvValue(config.daytonaApiKey) ??
    resolveEnvValue(process.env["VLLM_STUDIO_DAYTONA_API_KEY"]);

  if (!apiKey) {
    return null;
  }

  return { baseUrl, apiKey };
};

export const resolveConfiguredProviderConfig = (
  providerId: string,
  providers: ProviderConfig[] = []
): ProviderRouteConfig | null => {
  const match = providers.find(
    (p) => p.id.toLowerCase() === providerId.toLowerCase() && p.enabled
  );
  if (!match || !match.api_key) return null;
  return { baseUrl: match.base_url, apiKey: match.api_key };
};

export const resolveProviderConfig = (
  provider: string,
  config: ControllerProviderRoutingConfig = {}
): ProviderRouteConfig | null => {
  if (provider === DAYTONA_PROVIDER) {
    return resolveDaytonaProviderConfig(config);
  }
  return resolveConfiguredProviderConfig(provider, config.providers);
};
