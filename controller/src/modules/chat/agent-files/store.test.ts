import { describe, expect, it } from "bun:test";
import type { Config } from "../../../config/env";
import { getSessionFsApi } from "./store";

const createConfig = (overrides: Partial<Config> = {}): Config => ({
  host: "0.0.0.0",
  port: 8080,
  inference_port: 8000,
  data_dir: "/tmp/vllm-studio",
  db_path: "/tmp/vllm-studio/controller.db",
  models_dir: "/models",
  strict_openai_models: false,
  daytona_agent_mode: true,
  ...overrides,
});

describe("agent files store", () => {
  it("requires daytona mode for session filesystem access", async () => {
    const context = {
      config: createConfig({
        daytona_agent_mode: false,
      }),
    };

    await expect(getSessionFsApi(context as never, "session-1")).rejects.toThrow(
      "Daytona agent mode is required"
    );
  });
});
