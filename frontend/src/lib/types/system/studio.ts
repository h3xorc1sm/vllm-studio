// CRITICAL
/**
 * App-level settings + diagnostics.
 */

import type { GPU } from "./metrics";
import type { SystemConfig } from "./config";

export interface StudioSettings {
  config_path: string;
  persisted: {
    models_dir?: string;
    daytona_api_url?: string;
    daytona_proxy_url?: string;
    daytona_sandbox_id?: string;
    daytona_agent_mode?: boolean;
    agent_fs_local_fallback?: boolean;
    daytona_api_key_configured?: boolean;
    electricity_rate?: number;
    electricity_currency?: string;
    cloud_price_anthropic_input?: number;
    cloud_price_anthropic_output?: number;
    cloud_price_openai_input?: number;
    cloud_price_openai_output?: number;
  };
  effective: {
    models_dir: string;
    daytona_api_url: string | null;
    daytona_proxy_url: string | null;
    daytona_sandbox_id: string | null;
    daytona_agent_mode: boolean;
    agent_fs_local_fallback: boolean;
    daytona_api_key_configured: boolean;
    electricity_rate: number;
    electricity_currency: string;
    cloud_price_anthropic_input: number;
    cloud_price_anthropic_output: number;
    cloud_price_openai_input: number;
    cloud_price_openai_output: number;
  };
}

export interface StudioDiagnostics {
  app_version: string;
  timestamp: string;
  platform: string;
  arch: string;
  release: string;
  cpu_model: string | null;
  cpu_cores: number;
  memory_total: number;
  memory_free: number;
  gpus: GPU[];
  runtime: {
    vllm_installed: boolean;
    vllm_version: string | null;
    python_path: string | null;
    vllm_bin: string | null;
  };
  disks: Array<{
    path: string;
    total_bytes: number | null;
    free_bytes: number | null;
    available_bytes: number | null;
  }>;
  config: SystemConfig;
}
