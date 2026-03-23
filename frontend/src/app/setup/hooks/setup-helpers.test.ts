import { describe, expect, it } from "vitest";
import { buildStarterRecipe } from "./setup-helpers";

describe("buildStarterRecipe", () => {
  it("creates a vllm starter recipe with safe defaults", () => {
    const recipe = buildStarterRecipe(
      {
        id: "download-1",
        model_id: "NousResearch/Hermes-3-Llama-3.1-8B",
        revision: "main",
        status: "completed",
        created_at: "2026-03-23T12:00:00.000Z",
        updated_at: "2026-03-23T12:00:00.000Z",
        target_dir: "/models/hermes-3",
        total_bytes: 100,
        downloaded_bytes: 100,
        files: [],
        error: null,
      },
      [],
    );

    expect(recipe).toMatchObject({
      id: "hermes-3-llama-3-1-8b",
      name: "NousResearch/Hermes-3-Llama-3.1-8B",
      model_path: "/models/hermes-3",
      backend: "vllm",
      served_model_name: "NousResearch/Hermes-3-Llama-3.1-8B",
      trust_remote_code: true,
      dtype: "auto",
      kv_cache_dtype: "auto",
      tensor_parallel_size: 1,
      pipeline_parallel_size: 1,
      gpu_memory_utilization: 0.9,
      max_model_len: 32768,
      max_num_seqs: 256,
    });
  });

  it("deduplicates recipe ids when the model was already scaffolded", () => {
    const recipe = buildStarterRecipe(
      {
        id: "download-1",
        model_id: "meta-llama/Llama-3.1-8B-Instruct",
        revision: "main",
        status: "completed",
        created_at: "2026-03-23T12:00:00.000Z",
        updated_at: "2026-03-23T12:00:00.000Z",
        target_dir: "/models/llama",
        total_bytes: 100,
        downloaded_bytes: 100,
        files: [],
        error: null,
      },
      [{ id: "llama-3-1-8b-instruct" }],
    );

    expect(recipe.id).toBe("llama-3-1-8b-instruct-1");
  });
});
