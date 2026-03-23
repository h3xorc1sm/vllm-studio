import type { ProcessInfo, RecipeWithStatus, StudioDiagnostics } from "@/lib/types";

const LOCAL_HOSTS = new Set(["", "0.0.0.0", "127.0.0.1", "::1", "localhost"]);

const stripScheme = (value: string | null | undefined): string => {
  if (!value) return "";
  return (
    value
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "")
      .split(":")[0] ?? ""
  );
};

export const isLocalHost = (value: string | null | undefined): boolean =>
  LOCAL_HOSTS.has(stripScheme(value).toLowerCase());

const resolveEndpointHost = (
  configHost: string,
  browserHostname?: string | null,
): { host: string; needsRemoteHostReplacement: boolean } => {
  const normalizedBrowserHost = stripScheme(browserHostname);
  if (normalizedBrowserHost && !isLocalHost(normalizedBrowserHost)) {
    return { host: normalizedBrowserHost, needsRemoteHostReplacement: false };
  }

  const normalizedConfigHost = stripScheme(configHost);
  if (normalizedConfigHost && !isLocalHost(normalizedConfigHost)) {
    return { host: normalizedConfigHost, needsRemoteHostReplacement: false };
  }

  return {
    host: normalizedBrowserHost || normalizedConfigHost || "localhost",
    needsRemoteHostReplacement: true,
  };
};

const deriveModelName = (recipe: RecipeWithStatus | null, process: ProcessInfo | null): string => {
  const processModel = process?.model_path?.split("/").pop();
  return (
    recipe?.served_model_name ||
    process?.served_model_name ||
    recipe?.name ||
    recipe?.id ||
    processModel ||
    "your-model-name"
  );
};

export function buildHermesConnectionInfo({
  diagnostics,
  recipe,
  process,
  browserHostname,
}: {
  diagnostics: StudioDiagnostics;
  recipe: RecipeWithStatus | null;
  process: ProcessInfo | null;
  browserHostname?: string | null;
}) {
  const endpoint = resolveEndpointHost(diagnostics.config.host, browserHostname);
  const modelName = deriveModelName(recipe, process);

  return {
    baseUrl: `http://${endpoint.host}:${diagnostics.config.inference_port}/v1`,
    host: endpoint.host,
    modelName,
    inferencePort: diagnostics.config.inference_port,
    needsRemoteHostReplacement: endpoint.needsRemoteHostReplacement,
    recipeHermesReady:
      recipe?.tool_call_parser === "hermes" && recipe.enable_auto_tool_choice === true,
    apiKeyConfigured: diagnostics.config.api_key_configured,
  };
}
