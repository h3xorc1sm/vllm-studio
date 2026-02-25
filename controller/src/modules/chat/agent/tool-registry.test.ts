import { describe, expect, it } from "bun:test";
import type { Config } from "../../../config/env";
import { AGENT_TOOL_NAMES } from "./contracts";
import { buildAgentTools } from "./tool-registry";

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

describe("agent tool registry", () => {
  it("does not expose daytona-dependent file tools when daytona mode is disabled", async () => {
    const tools = await buildAgentTools(
      {
        config: createConfig({ daytona_agent_mode: false }),
      } as never,
      {
        sessionId: "session-1",
        agentMode: true,
        agentFiles: true,
      }
    );

    const names = tools.map((tool) => tool.name);
    expect(names).not.toContain(AGENT_TOOL_NAMES.LIST_FILES);
    expect(names).not.toContain(AGENT_TOOL_NAMES.WRITE_FILE);
    expect(names).toContain("create_plan");
    expect(names).toContain("update_plan");
  });
});
