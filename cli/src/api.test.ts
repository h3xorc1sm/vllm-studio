// CRITICAL
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CliApiError,
  evictModel,
  fetchConfig,
  fetchGPUs,
  fetchLifetimeMetrics,
  fetchRecipes,
  fetchStatus,
  launchRecipe,
} from "./api";

// Mock fetch
global.fetch = vi.fn();

describe("API Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VLLM_STUDIO_URL = "http://localhost:8080";
  });

  describe("fetchGPUs", () => {
    it("returns GPU array on success", async () => {
      const mockGPUs = [
        {
          index: 0,
          name: "NVIDIA A100",
          memory_used: 10,
          memory_total: 40,
          utilization: 50,
          temperature: 70,
          power_draw: 240,
        },
      ];

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ gpus: mockGPUs }),
        text: async () => JSON.stringify({ gpus: mockGPUs }),
      });

      const gpus = await fetchGPUs();
      expect(gpus).toEqual(mockGPUs);
    });

    it("throws on network failure", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Network error")
      );

      await expect(fetchGPUs()).rejects.toThrow(CliApiError);
    });

    it("throws when response is not ok", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => JSON.stringify({ detail: "boom" }),
      });

      await expect(fetchGPUs()).rejects.toThrow("Request failed for GET /gpus: boom");
    });
  });

  describe("fetchRecipes", () => {
    it("returns recipes array on success", async () => {
      const mockRecipes = [
        { id: "llama-3-8b", name: "Llama 3 8B", backend: "vllm", model_path: "/models/llama" },
      ];

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRecipes,
        text: async () => JSON.stringify(mockRecipes),
      });

      const recipes = await fetchRecipes();
      expect(recipes).toEqual(mockRecipes);
    });

    it("throws when payload is invalid", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ recipes: [] }),
      });

      await expect(fetchRecipes()).rejects.toThrow("Invalid response for GET /recipes");
    });
  });

  describe("fetchStatus", () => {
    it("returns mapped status on success", async () => {
      const mockStatus = {
        running: true,
        launching: "recipe-1",
        process: { pid: 1234, backend: "vllm", port: 8000, served_model_name: "llama" },
      };

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus,
        text: async () => JSON.stringify(mockStatus),
      });

      const status = await fetchStatus();
      expect(status.running).toBe(true);
      expect(status.launching).toBe(true);
      expect(status.model).toBe("llama");
      expect(status.backend).toBe("vllm");
      expect(status.pid).toBe(1234);
    });

    it("throws on invalid payload", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify("bad"),
      });

      await expect(fetchStatus()).rejects.toThrow("Invalid response for GET /status");
    });
  });

  describe("fetchConfig", () => {
    it("returns config block", async () => {
      const payload = {
        config: {
          port: 8080,
          inference_port: 8000,
          models_dir: "/models",
          data_dir: "/data",
        },
      };

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(payload),
      });

      const config = await fetchConfig();
      expect(config).toEqual(payload.config);
    });
  });

  describe("fetchLifetimeMetrics", () => {
    it("returns normalized lifetime metrics", async () => {
      const payload = {
        tokens_total: 1234,
        requests_total: 56,
        energy_kwh: 7.5,
      };

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(payload),
      });

      const metrics = await fetchLifetimeMetrics();
      expect(metrics).toEqual({
        total_tokens: 1234,
        total_requests: 56,
        total_energy_kwh: 7.5,
      });
    });
  });

  describe("launchRecipe", () => {
    it("returns success field when present", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: false }),
      });

      const ok = await launchRecipe("recipe-1");
      expect(ok).toBe(false);
    });
  });

  describe("evictModel", () => {
    it("throws on backend error", async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => JSON.stringify({ detail: "not found" }),
      });

      await expect(evictModel()).rejects.toThrow("Request failed for POST /evict: not found");
    });
  });
});
