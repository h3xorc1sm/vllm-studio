// CRITICAL
import { describe, expect, it } from "bun:test";
import type { Recipe } from "../types";
import {
  buildEnvironment,
  collectChildren,
  detectBackend,
  extractFlag,
} from "./process-utilities";

const makeRecipe = (extra: Partial<Recipe> = {}): Recipe => ({
  id: "recipe-test" as Recipe["id"],
  name: "Recipe Test",
  model_path: "/models/example",
  backend: "vllm",
  env_vars: null,
  tensor_parallel_size: 1,
  pipeline_parallel_size: 1,
  max_model_len: 4096,
  gpu_memory_utilization: 0.9,
  kv_cache_dtype: "auto",
  max_num_seqs: 32,
  trust_remote_code: false,
  tool_call_parser: null,
  reasoning_parser: null,
  enable_auto_tool_choice: false,
  quantization: null,
  dtype: null,
  host: "0.0.0.0",
  port: 8000,
  served_model_name: null,
  python_path: null,
  extra_args: {},
  max_thinking_tokens: null,
  thinking_mode: "auto",
  ...extra,
});

describe("process-utilities", () => {
  it("extracts CLI flag values and returns undefined for missing values", () => {
    const args = ["--model", "/models/qwen", "--port", "8000", "--flag-without-value"];

    expect(extractFlag(args, "--model")).toBe("/models/qwen");
    expect(extractFlag(args, "--port")).toBe("8000");
    expect(extractFlag(args, "--flag-without-value")).toBeUndefined();
    expect(extractFlag(args, "--not-present")).toBeUndefined();
  });

  it("detects known backend command signatures", () => {
    expect(detectBackend(["python", "-m", "vllm.entrypoints.openai.api_server"])).toBe("vllm");
    expect(detectBackend(["python", "-m", "sglang.launch_server"])).toBe("sglang");
    expect(detectBackend(["python", "main.py", "--config", "/tmp/tabby.yml"])).toBe("tabbyapi");
    expect(detectBackend(["llama-server", "-m", "/models/gguf"])).toBe("llamacpp");
    expect(detectBackend(["exllama-server", "--model", "/models/exl3"])).toBe("exllamav3");
    expect(detectBackend(["bash", "-lc", "echo hello"])).toBeNull();
  });

  it("builds environment with recipe env vars and extra env overrides", () => {
    const recipe = makeRecipe({
      env_vars: {
        KEEP: "yes",
        SHARED: "from_recipe",
      },
      extra_args: {
        env_vars: {
          SHARED: "from_extra",
          EXTRA_ONLY: "1",
        },
      },
    });

    const env = buildEnvironment(recipe);
    expect(env["FLASHINFER_DISABLE_VERSION_CHECK"]).toBe("1");
    expect(env["KEEP"]).toBe("yes");
    expect(env["EXTRA_ONLY"]).toBe("1");
    expect(env["SHARED"]).toBe("from_extra");
  });

  it("supports env-vars alias shape in extra_args", () => {
    const recipe = makeRecipe({
      extra_args: {
        "env-vars": {
          KEBAB_CASE_VAR: "ok",
        },
      },
    });

    const env = buildEnvironment(recipe);
    expect(env["KEBAB_CASE_VAR"]).toBe("ok");
  });

  it("collects descendant pids recursively without duplicating shared children", () => {
    const tree = new Map<number, number[]>([
      [100, [101, 102]],
      [101, [103]],
      [102, [103, 104]],
      [104, [105]],
    ]);
    const descendants = new Set<number>();

    collectChildren(tree, 100, descendants);

    expect(Array.from(descendants).sort((a, b) => a - b)).toEqual([101, 102, 103, 104, 105]);
  });
});
