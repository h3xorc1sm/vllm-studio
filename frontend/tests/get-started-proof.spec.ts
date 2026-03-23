// CRITICAL
import { mkdirSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const BACKEND_URL = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://localhost:8080";

test("get started: renders Hermes guide and completes the setup launch flow", async ({ page }) => {
  const uiProofDir = path.join(process.cwd(), "test-output", "ui-proof");
  mkdirSync(uiProofDir, { recursive: true });

  const state = {
    downloads: [] as Array<Record<string, unknown>>,
    createdRecipe: null as Record<string, unknown> | null,
  };

  await page.context().addCookies([
    {
      name: "vllmstudio_backend_url",
      value: BACKEND_URL,
      url: BASE,
    },
  ]);
  await page.addInitScript((url) => {
    window.localStorage.setItem("vllmstudio_backend_url", String(url));
  }, BACKEND_URL);

  await page.route("**/api/proxy/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const targetPath = url.pathname.replace("/api/proxy", "");
    const method = request.method();

    if (targetPath === "/studio/settings" && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          config_path: "/tmp/studio-settings.json",
          persisted: { models_dir: "/models" },
          effective: {
            models_dir: "/models",
            daytona_api_url: null,
            daytona_proxy_url: null,
            daytona_sandbox_id: null,
            daytona_agent_mode: false,
            agent_fs_local_fallback: false,
            daytona_api_key_configured: false,
          },
        }),
      });
      return;
    }

    if (targetPath === "/studio/settings" && method === "POST") {
      const body = JSON.parse(request.postData() ?? "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          config_path: "/tmp/studio-settings.json",
          persisted: { models_dir: body.models_dir ?? "/models" },
          effective: {
            models_dir: body.models_dir ?? "/models",
            daytona_api_url: null,
            daytona_proxy_url: null,
            daytona_sandbox_id: null,
            daytona_agent_mode: false,
            agent_fs_local_fallback: false,
            daytona_api_key_configured: false,
          },
        }),
      });
      return;
    }

    if (targetPath === "/studio/diagnostics") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          app_version: "dev",
          timestamp: "2026-03-23T00:00:00.000Z",
          platform: "darwin",
          arch: "arm64",
          release: "24.0.0",
          cpu_model: "M4 Max",
          cpu_cores: 16,
          memory_total: 68719476736,
          memory_free: 34359738368,
          gpus: [{ name: "RTX 4090", memory_total_mb: 24564 }],
          runtime: {
            vllm_installed: true,
            vllm_version: "0.8.0",
            python_path: "/usr/bin/python3",
            vllm_bin: "/usr/local/bin/vllm",
          },
          disks: [],
          config: {
            host: "127.0.0.1",
            port: 8080,
            inference_port: 8000,
            api_key_configured: false,
            models_dir: "/models",
            data_dir: "/data",
            db_path: "/data/studio.db",
            sglang_python: null,
            tabby_api_dir: null,
            llama_bin: null,
            exllamav3_command_configured: false,
            daytona_api_url: null,
            daytona_proxy_url: null,
            daytona_sandbox_id: null,
            daytona_agent_mode: false,
            agent_fs_local_fallback: false,
            daytona_api_key_configured: false,
          },
        }),
      });
      return;
    }

    if (targetPath === "/studio/recommendations") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          max_vram_gb: 24,
          recommendations: [
            {
              id: "NousResearch/Hermes-3-Llama-3.1-8B",
              name: "Hermes 3 8B",
              description: "Starter Hermes model",
              size_gb: 8,
              min_vram_gb: 10,
            },
          ],
        }),
      });
      return;
    }

    if (targetPath === "/status") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          running: true,
          process: {
            pid: 4242,
            backend: "vllm",
            model_path: "/models/hermes-3",
            port: 8000,
            served_model_name: "NousResearch/Hermes-3-Llama-3.1-8B",
          },
          inference_port: 8000,
        }),
      });
      return;
    }

    if (targetPath === "/recipes" && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "hermes-3",
            name: "NousResearch/Hermes-3-Llama-3.1-8B",
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
            served_model_name: "NousResearch/Hermes-3-Llama-3.1-8B",
            python_path: null,
            extra_args: {},
            max_thinking_tokens: null,
            thinking_mode: "off",
            status: "running",
          },
        ]),
      });
      return;
    }

    if (targetPath === "/studio/downloads" && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ downloads: state.downloads }),
      });
      return;
    }

    if (targetPath === "/studio/downloads" && method === "POST") {
      state.downloads = [
        {
          id: "download-1",
          model_id: "NousResearch/Hermes-3-Llama-3.1-8B",
          revision: "main",
          status: "completed",
          created_at: "2026-03-23T00:00:00.000Z",
          updated_at: "2026-03-23T00:00:00.000Z",
          target_dir: "/models/hermes-3",
          total_bytes: 100,
          downloaded_bytes: 100,
          files: [],
          error: null,
        },
      ];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ download: state.downloads[0] }),
      });
      return;
    }

    if (targetPath.startsWith("/studio/downloads/") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ download: state.downloads[0] }),
      });
      return;
    }

    if (targetPath === "/recipes" && method === "POST") {
      state.createdRecipe = JSON.parse(request.postData() ?? "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, id: "hermes-3-llama-3-1-8b" }),
      });
      return;
    }

    if (targetPath.startsWith("/launch/") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, pid: 4242, message: "launching" }),
      });
      return;
    }

    if (targetPath === "/wait-ready") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ready: true, elapsed: 1 }),
      });
      return;
    }

    if (targetPath.startsWith("/benchmark") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          model_id: "NousResearch/Hermes-3-Llama-3.1-8B",
          benchmark: {
            prompt_tokens: 1000,
            completion_tokens: 100,
            total_time_s: 2.5,
            generation_tps: 40,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: `Unhandled route: ${method} ${targetPath}` }),
    });
  });

  await page.goto("/get-started");
  await expect(
    page.getByRole("heading", { name: /Desktop onboarding and Hermes deployment/i }),
  ).toBeVisible();
  await expect(page.getByText("http://localhost:8000/v1", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Tool Call Parser = Hermes")).toBeVisible();
  await page.screenshot({ path: path.join(uiProofDir, "get-started-page.png"), fullPage: true });

  await page.getByRole("link", { name: "Start Setup" }).click();
  await expect(page.getByRole("heading", { name: /vLLM Studio Desktop/i })).toBeVisible();

  await page.getByRole("button", { name: /^Continue$/ }).click();
  await page.getByLabel(/I confirmed this hardware summary/i).check();
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await page
    .getByRole("button", { name: /^Download$/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Continue to Launch" }).click();
  await page.getByRole("button", { name: "Configure & Launch" }).click();
  await expect(page.getByRole("heading", { name: /Benchmark the Running Model/i })).toBeVisible();
  await page.getByRole("button", { name: "Run Benchmark" }).click();
  await expect(page.getByText("Benchmark completed.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Chat" })).toBeVisible();
  await page.screenshot({
    path: path.join(uiProofDir, "setup-benchmark-complete.png"),
    fullPage: true,
  });

  expect(state.createdRecipe).toMatchObject({
    backend: "vllm",
    served_model_name: "NousResearch/Hermes-3-Llama-3.1-8B",
    trust_remote_code: true,
    dtype: "auto",
    kv_cache_dtype: "auto",
  });
});
