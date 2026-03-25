// CRITICAL
import { config as loadEnvironment } from "dotenv";
import { z } from "zod";
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { loadPersistedConfig, type ProviderConfig } from "./persisted-config";

/**
 * Runtime configuration for the controller.
 */
export type OpenAIModelActivationPolicy = "load_if_idle" | "switch_on_request";

export interface Config {
  host: string;
  port: number;
  api_key?: string;
  cors_origins?: string[];
  daytona_api_url?: string;
  daytona_api_key?: string;
  daytona_proxy_url?: string;
  daytona_sandbox_id?: string;
  daytona_agent_mode: boolean;
  agent_fs_local_fallback: boolean;
  inference_port: number;

  data_dir: string;
  db_path: string;
  models_dir: string;
  sglang_python?: string;
  tabby_api_dir?: string;
  llama_bin?: string;
  exllamav3_command?: string;
  strict_openai_models: boolean;
  openai_model_activation_policy?: OpenAIModelActivationPolicy;
  providers: ProviderConfig[];
}

/**
 * Load the closest .env file from current or parent directories.
 * @returns The loaded .env path or undefined.
 */
export const loadDotEnvironment = (): string | undefined => {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env"),
    resolve(process.cwd(), "..", "..", ".env"),
  ];

  const envPath = candidates.find((pathValue) => existsSync(pathValue));
  if (envPath) {
    loadEnvironment({ path: envPath });
  }
  return envPath;
};

/**
 * Create a validated runtime configuration from environment variables.
 * @returns Validated configuration object.
 */
export const createConfig = (): Config => {
  loadDotEnvironment();

  const cwd = process.cwd();
  const localDataDirectory = resolve(cwd, "data");
  const parentDataDirectory = resolve(cwd, "..", "data");
  const defaultDataDirectory =
    basename(cwd) === "controller" && existsSync(parentDataDirectory)
      ? parentDataDirectory
      : localDataDirectory;
  const defaultDatabasePath = resolve(defaultDataDirectory, "controller.db");

  const isLoopbackHost = (value: string): boolean => {
    const normalized = value.trim().toLowerCase();
    return normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1";
  };

  const parseBooleanFlag = (value: string | undefined): boolean => {
    if (!value) return false;
    return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
  };

  const normalizeOrigin = (value: string): string | null => {
    try {
      const origin = new URL(value.trim()).origin;
      return origin === "null" ? null : origin;
    } catch {
      return null;
    }
  };

  const parseCorsOrigins = (value: string | undefined): string[] => {
    const defaults = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
      "http://host.docker.internal:3000",
      "http://host.docker.internal:3001",
    ];
    const candidates =
      value && value.trim().length > 0 ? value.split(",").map((entry) => entry.trim()) : defaults;
    return [...new Set(candidates.map((entry) => normalizeOrigin(entry)).filter((entry): entry is string => Boolean(entry)))];
  };

  const schema = z.object({
    VLLM_STUDIO_HOST: z.string().default("127.0.0.1"),
    VLLM_STUDIO_PORT: z.coerce.number().int().positive().default(8080),
    VLLM_STUDIO_API_KEY: z.string().optional(),
    VLLM_STUDIO_ALLOW_UNAUTHENTICATED: z.string().optional(),
    VLLM_STUDIO_CORS_ORIGINS: z.string().optional(),
    VLLM_STUDIO_DAYTONA_API_KEY: z.string().optional(),
    VLLM_STUDIO_DAYTONA_API_URL: z.string().optional(),
    VLLM_STUDIO_DAYTONA_PROXY_URL: z.string().optional(),
    VLLM_STUDIO_DAYTONA_SANDBOX_ID: z.string().optional(),
    VLLM_STUDIO_DAYTONA_AGENT_MODE: z.string().optional(),
    VLLM_STUDIO_AGENT_FS_LOCAL_FALLBACK: z.string().optional(),
    VLLM_STUDIO_INFERENCE_PORT: z.coerce.number().int().positive().default(8000),

    VLLM_STUDIO_DATA_DIR: z.string().default(defaultDataDirectory),
    VLLM_STUDIO_DB_PATH: z.string().default(defaultDatabasePath),
    VLLM_STUDIO_MODELS_DIR: z.string().default("/models"),
    VLLM_STUDIO_SGLANG_PYTHON: z.string().optional(),
    VLLM_STUDIO_TABBY_API_DIR: z.string().optional(),
    VLLM_STUDIO_LLAMA_BIN: z.string().optional(),
    VLLM_STUDIO_EXLLAMAV3_COMMAND: z.string().optional(),
    VLLM_STUDIO_STRICT_OPENAI_MODELS: z.string().optional(),
    VLLM_STUDIO_OPENAI_MODEL_ACTIVATION_POLICY: z.string().optional(),
  });

  const parsed = schema.parse(process.env);
  const host = parsed.VLLM_STUDIO_HOST.trim() || "127.0.0.1";

  const strictOpenAIModels = parsed.VLLM_STUDIO_STRICT_OPENAI_MODELS;
  const strictOpenAIModelsEnabled = strictOpenAIModels
    ? ["1", "true", "yes", "on"].includes(strictOpenAIModels.trim().toLowerCase())
    : false;
  const daytonaAgentModeRaw = parsed.VLLM_STUDIO_DAYTONA_AGENT_MODE;
  const daytonaAgentMode = daytonaAgentModeRaw
    ? ["1", "true", "yes", "on"].includes(daytonaAgentModeRaw.trim().toLowerCase())
    : true;
  const localAgentFsFallbackRaw = parsed.VLLM_STUDIO_AGENT_FS_LOCAL_FALLBACK;
  const localAgentFsFallback = localAgentFsFallbackRaw
    ? ["1", "true", "yes", "on"].includes(localAgentFsFallbackRaw.trim().toLowerCase())
    : false;
  const activationPolicyRaw = parsed.VLLM_STUDIO_OPENAI_MODEL_ACTIVATION_POLICY
    ?.trim()
    .toLowerCase();
  const openaiModelActivationPolicy: OpenAIModelActivationPolicy =
    activationPolicyRaw === "switch_on_request" ? "switch_on_request" : "load_if_idle";

  const config: Config = {
    host,
    port: parsed.VLLM_STUDIO_PORT,
    inference_port: parsed.VLLM_STUDIO_INFERENCE_PORT,

    data_dir: resolve(parsed.VLLM_STUDIO_DATA_DIR),
    db_path: resolve(parsed.VLLM_STUDIO_DB_PATH),
    models_dir: resolve(parsed.VLLM_STUDIO_MODELS_DIR),
    strict_openai_models: strictOpenAIModelsEnabled,
    daytona_agent_mode: daytonaAgentMode,
    agent_fs_local_fallback: localAgentFsFallback,
    openai_model_activation_policy: openaiModelActivationPolicy,
    cors_origins: parseCorsOrigins(parsed.VLLM_STUDIO_CORS_ORIGINS),
    providers: [],
  };

  if (parsed.VLLM_STUDIO_API_KEY) {
    config.api_key = parsed.VLLM_STUDIO_API_KEY;
  }

  const allowUnauthenticated = parseBooleanFlag(parsed.VLLM_STUDIO_ALLOW_UNAUTHENTICATED);
  if (!config.api_key && !allowUnauthenticated && !isLoopbackHost(host)) {
    throw new Error(
      "VLLM_STUDIO_API_KEY is required when binding the controller to a non-loopback host. Set VLLM_STUDIO_ALLOW_UNAUTHENTICATED=true only for trusted local environments."
    );
  }

  if (parsed.VLLM_STUDIO_DAYTONA_API_KEY) {
    config.daytona_api_key = parsed.VLLM_STUDIO_DAYTONA_API_KEY;
  }
  if (parsed.VLLM_STUDIO_DAYTONA_API_URL) {
    const raw = parsed.VLLM_STUDIO_DAYTONA_API_URL.trim();
    if (raw) {
      config.daytona_api_url = raw;
    }
  }
  if (parsed.VLLM_STUDIO_DAYTONA_PROXY_URL) {
    const raw = parsed.VLLM_STUDIO_DAYTONA_PROXY_URL.trim();
    if (raw) {
      config.daytona_proxy_url = raw;
    }
  }
  if (parsed.VLLM_STUDIO_DAYTONA_SANDBOX_ID) {
    const raw = parsed.VLLM_STUDIO_DAYTONA_SANDBOX_ID.trim();
    if (raw) {
      config.daytona_sandbox_id = raw;
    }
  }
  if (parsed.VLLM_STUDIO_SGLANG_PYTHON) {
    config.sglang_python = parsed.VLLM_STUDIO_SGLANG_PYTHON;
  }
  if (parsed.VLLM_STUDIO_TABBY_API_DIR) {
    config.tabby_api_dir = parsed.VLLM_STUDIO_TABBY_API_DIR;
  }
  if (parsed.VLLM_STUDIO_LLAMA_BIN) {
    config.llama_bin = parsed.VLLM_STUDIO_LLAMA_BIN;
  }
  if (parsed.VLLM_STUDIO_EXLLAMAV3_COMMAND) {
    const command = parsed.VLLM_STUDIO_EXLLAMAV3_COMMAND.trim();
    if (command) {
      config.exllamav3_command = command;
    }
  }

  const persisted = loadPersistedConfig(config.data_dir);
  if (persisted.models_dir) {
    config.models_dir = resolve(persisted.models_dir);
  }
  if (typeof persisted.daytona_agent_mode === "boolean") {
    config.daytona_agent_mode = persisted.daytona_agent_mode;
  }
  if (typeof persisted.agent_fs_local_fallback === "boolean") {
    config.agent_fs_local_fallback = persisted.agent_fs_local_fallback;
  }
  if (typeof persisted.daytona_api_key === "string") {
    const value = persisted.daytona_api_key.trim();
    if (value) {
      config.daytona_api_key = value;
    } else {
      delete config.daytona_api_key;
    }
  }
  if (typeof persisted.daytona_api_url === "string") {
    const value = persisted.daytona_api_url.trim();
    if (value) {
      config.daytona_api_url = value;
    } else {
      delete config.daytona_api_url;
    }
  }
  if (typeof persisted.daytona_proxy_url === "string") {
    const value = persisted.daytona_proxy_url.trim();
    if (value) {
      config.daytona_proxy_url = value;
    } else {
      delete config.daytona_proxy_url;
    }
  }
  if (typeof persisted.daytona_sandbox_id === "string") {
    const value = persisted.daytona_sandbox_id.trim();
    if (value) {
      config.daytona_sandbox_id = value;
    } else {
      delete config.daytona_sandbox_id;
    }
  }

  if (Array.isArray(persisted.providers)) {
    config.providers = persisted.providers;
  }

  return config;
};
