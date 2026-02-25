import { describe, expect, it } from "bun:test";
import type { Config } from "../../config/env";
import { isDaytonaAgentModeEnabled, resolveDaytonaProxyBaseUrl } from "./toolbox-client";

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

describe("daytona toolbox config", () => {
  it("derives proxy URL from API base URL", () => {
    expect(resolveDaytonaProxyBaseUrl("https://app.daytona.io/api")).toBe(
      "https://proxy.app.daytona.io"
    );
  });

  it("respects explicit proxy URL override", () => {
    expect(
      resolveDaytonaProxyBaseUrl("https://app.daytona.io/api", "https://proxy.custom.daytona")
    ).toBe("https://proxy.custom.daytona");
  });

  it("enables daytona mode only when key is present", () => {
    expect(isDaytonaAgentModeEnabled(createConfig())).toBe(false);
    expect(isDaytonaAgentModeEnabled(createConfig({ daytona_api_key: "token" }))).toBe(true);
  });

  it("disables daytona mode when feature flag is off", () => {
    expect(
      isDaytonaAgentModeEnabled(
        createConfig({
          daytona_api_key: "token",
          daytona_agent_mode: false,
        })
      )
    ).toBe(false);
  });
});
