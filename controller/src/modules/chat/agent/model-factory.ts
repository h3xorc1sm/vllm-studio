// CRITICAL
import { getModel } from "@mariozechner/pi-ai";
import type { Model } from "@mariozechner/pi-ai";
import { AGENT_DEFAULT_OPENAI_MODEL, AGENT_DEFAULT_OPENAI_PROVIDER } from "./configs";

export const createOpenAiCompatibleModel = (
  modelId: string,
  baseUrl: string,
  provider = AGENT_DEFAULT_OPENAI_PROVIDER,
): Model<"openai-completions"> => {
  const base = getModel("openai", AGENT_DEFAULT_OPENAI_MODEL);
  const normalizedProvider =
    typeof provider === "string" && provider.trim().length > 0
      ? provider.trim()
      : AGENT_DEFAULT_OPENAI_PROVIDER;
  return {
    ...base,
    id: modelId,
    name: modelId,
    api: "openai-completions",
    provider: normalizedProvider,
    baseUrl,
  };
};
