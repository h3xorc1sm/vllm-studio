import { describe, expect, it } from "vitest";
import { buildHermesConnectionInfo, isLocalHost } from "./hermes";

describe("isLocalHost", () => {
  it("detects localhost-style hosts", () => {
    expect(isLocalHost("localhost")).toBe(true);
    expect(isLocalHost("http://127.0.0.1")).toBe(true);
    expect(isLocalHost("0.0.0.0")).toBe(true);
    expect(isLocalHost("studio.example.com")).toBe(false);
  });
});

describe("buildHermesConnectionInfo", () => {
  it("prefers the browser hostname when config.host is local-only", () => {
    const info = buildHermesConnectionInfo({
      diagnostics: {
        app_version: "dev",
        timestamp: "2026-03-23T00:00:00.000Z",
        platform: "darwin",
        arch: "arm64",
        release: "24.0.0",
        cpu_model: "M4 Max",
        cpu_cores: 16,
        memory_total: 1,
        memory_free: 1,
        gpus: [],
        runtime: {
          vllm_installed: true,
          vllm_version: "0.8.0",
          python_path: null,
          vllm_bin: null,
        },
        disks: [],
        config: {
          host: "0.0.0.0",
          port: 8080,
          inference_port: 8000,
          api_key_configured: false,
          models_dir: "/models",
          data_dir: "/data",
          db_path: "/db",
          sglang_python: null,
          tabby_api_dir: null,
          llama_bin: null,
          daytona_api_url: null,
          daytona_proxy_url: null,
          daytona_sandbox_id: null,
          daytona_agent_mode: false,
          agent_fs_local_fallback: false,
          daytona_api_key_configured: false,
        },
      },
      recipe: {
        id: "starter",
        name: "NousResearch/Hermes-3",
        model_path: "/models/hermes-3",
        backend: "vllm",
        env_vars: null,
        tensor_parallel_size: 1,
        pipeline_parallel_size: 1,
        max_model_len: 32768,
        gpu_memory_utilization: 0.9,
        kv_cache_dtype: "auto",
        max_num_seqs: 256,
        trust_remote_code: true,
        tool_call_parser: "hermes",
        reasoning_parser: null,
        enable_auto_tool_choice: true,
        quantization: null,
        dtype: "auto",
        host: "0.0.0.0",
        port: 8000,
        served_model_name: "NousResearch/Hermes-3",
        target_node_id: null,
        python_path: null,
        extra_args: {},
        max_thinking_tokens: null,
        thinking_mode: "off",
        status: "running",
      },
      process: null,
      browserHostname: "studio.lan",
    });

    expect(info.baseUrl).toBe("http://studio.lan:8000/v1");
    expect(info.modelName).toBe("NousResearch/Hermes-3");
    expect(info.recipeHermesReady).toBe(true);
    expect(info.needsRemoteHostReplacement).toBe(false);
  });

  it("falls back to localhost and warns when the endpoint is local-only", () => {
    const info = buildHermesConnectionInfo({
      diagnostics: {
        app_version: "dev",
        timestamp: "2026-03-23T00:00:00.000Z",
        platform: "darwin",
        arch: "arm64",
        release: "24.0.0",
        cpu_model: "M4 Max",
        cpu_cores: 16,
        memory_total: 1,
        memory_free: 1,
        gpus: [],
        runtime: {
          vllm_installed: true,
          vllm_version: "0.8.0",
          python_path: null,
          vllm_bin: null,
        },
        disks: [],
        config: {
          host: "127.0.0.1",
          port: 8080,
          inference_port: 8000,
          api_key_configured: true,
          models_dir: "/models",
          data_dir: "/data",
          db_path: "/db",
          sglang_python: null,
          tabby_api_dir: null,
          llama_bin: null,
          daytona_api_url: null,
          daytona_proxy_url: null,
          daytona_sandbox_id: null,
          daytona_agent_mode: false,
          agent_fs_local_fallback: false,
          daytona_api_key_configured: false,
        },
      },
      recipe: null,
      process: {
        pid: 1,
        backend: "vllm",
        model_path: "/models/demo",
        port: 8000,
        served_model_name: null,
      },
      browserHostname: "localhost",
    });

    expect(info.baseUrl).toBe("http://localhost:8000/v1");
    expect(info.modelName).toBe("demo");
    expect(info.needsRemoteHostReplacement).toBe(true);
    expect(info.apiKeyConfigured).toBe(true);
  });
});
