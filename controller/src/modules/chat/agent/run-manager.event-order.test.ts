// CRITICAL
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AppContext } from "../../../types/context";
import { ChatStore } from "../store";
import { AGENT_RUN_EVENT_TYPES } from "./contracts";
import { ChatRunManager } from "./run-manager";

type StreamEvent = {
  type: string;
  data: Record<string, unknown>;
};

function createTestContext(chatStore: ChatStore): AppContext {
  return {
    config: {
      host: "0.0.0.0",
      port: 8080,
      inference_port: 8000,
      data_dir: "/tmp",
      db_path: "/tmp/controller.db",
      models_dir: "/tmp/models",
      strict_openai_models: false,
      daytona_agent_mode: false,
    },
    logger: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    eventManager: {
      publish: async () => undefined,
    },
    processManager: {
      findInferenceProcess: async () => null,
    },
    stores: {
      chatStore,
    },
  } as unknown as AppContext;
}

async function collectStreamEvents(stream: AsyncIterable<string>): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];

  for await (const chunk of stream) {
    if (!chunk) continue;
    if (chunk.startsWith(":")) continue;

    const eventMatch = chunk.match(/^event:\s*([^\n]+)$/m);
    const dataMatch = chunk.match(/^data:\s*(.+)$/m);
    if (!eventMatch || !dataMatch) continue;

    const type = eventMatch[1]?.trim() ?? "";
    const data = JSON.parse(dataMatch[1] ?? "{}") as Record<string, unknown>;
    events.push({ type, data });

    if (type === AGENT_RUN_EVENT_TYPES.RUN_END) {
      break;
    }
  }

  return events;
}

describe("ChatRunManager event ordering", () => {
  const previousMockInference = process.env["VLLM_STUDIO_MOCK_INFERENCE"];

  afterEach(() => {
    if (previousMockInference === undefined) {
      delete process.env["VLLM_STUDIO_MOCK_INFERENCE"];
    } else {
      process.env["VLLM_STUDIO_MOCK_INFERENCE"] = previousMockInference;
    }
  });

  it("emits deterministic mock run events in order", async () => {
    process.env["VLLM_STUDIO_MOCK_INFERENCE"] = "1";

    const tempDir = mkdtempSync(join(tmpdir(), "vllm-chat-run-"));
    const dbPath = join(tempDir, "chat.db");

    try {
      const chatStore = new ChatStore(dbPath);
      const sessionId = "session-event-order";
      chatStore.createSession(sessionId, "Test", "default");

      const context = createTestContext(chatStore);
      const runManager = new ChatRunManager(context);

      const run = await runManager.startRun({
        sessionId,
        content: "hello world",
        agentMode: true,
      });

      const events = await collectStreamEvents(run.stream);
      const eventTypes = events.map((event) => event.type);

      expect(eventTypes).toEqual([
        AGENT_RUN_EVENT_TYPES.RUN_START,
        AGENT_RUN_EVENT_TYPES.TURN_START,
        AGENT_RUN_EVENT_TYPES.MESSAGE_START,
        AGENT_RUN_EVENT_TYPES.MESSAGE_END,
        AGENT_RUN_EVENT_TYPES.TURN_END,
        AGENT_RUN_EVENT_TYPES.RUN_END,
      ]);

      const runEnd = events.find((event) => event.type === AGENT_RUN_EVENT_TYPES.RUN_END);
      expect(runEnd?.data["status"]).toBe("completed");
      expect(runEnd?.data["error"]).toBeNull();

      const runIds = new Set(events.map((event) => String(event.data["run_id"] ?? "")));
      expect(runIds.size).toBe(1);

      const sessionIds = new Set(events.map((event) => String(event.data["session_id"] ?? "")));
      expect(sessionIds).toEqual(new Set([sessionId]));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
