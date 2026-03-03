import { describe, expect, it } from "vitest";
import { createInitialRunMachineState, transitionRunMachine } from "./run-machine";
import type { RunMachineContext } from "./types";

function makeContext(overrides?: Partial<RunMachineContext>): RunMachineContext {
  return {
    currentSessionId: "session-1",
    currentSessionTitle: "New Chat",
    lastUserInput: "hello",
    lastAssistantContent: "",
    ...overrides,
  };
}

describe("run-machine", () => {
  it("starts run on run_start event", () => {
    const state = createInitialRunMachineState();
    const next = transitionRunMachine(state, makeContext(), {
      now: 100,
      event: { event: "run_start", data: { run_id: "run-1", session_id: "session-1" } },
      mapAgentMessageToChatMessage: () => null,
    });

    expect(next.state.phase).toBe("active");
    expect(next.state.activeRunId).toBe("run-1");
    expect(next.effects.some((effect) => effect.type === "stream/clear-error")).toBe(true);
  });

  it("maps tool execution start/end to tool effects", () => {
    const state = {
      ...createInitialRunMachineState(),
      phase: "active" as const,
      activeRunId: "run-1",
    };

    const started = transitionRunMachine(state, makeContext(), {
      now: 101,
      event: {
        event: "tool_execution_start",
        data: { run_id: "run-1", session_id: "session-1", toolCallId: "tc-1", toolName: "read", args: { path: "a.ts" } },
      },
      mapAgentMessageToChatMessage: () => null,
    });

    expect(started.effects).toContainEqual({
      type: "tools/start",
      toolCallId: "tc-1",
      toolName: "read",
      input: { path: "a.ts" },
    });

    const ended = transitionRunMachine(state, makeContext(), {
      now: 102,
      event: {
        event: "tool_execution_end",
        data: { run_id: "run-1", session_id: "session-1", toolCallId: "tc-1", result: { text: "ok" }, isError: false },
      },
      mapAgentMessageToChatMessage: () => null,
    });

    expect(ended.effects.some((effect) => effect.type === "tools/end")).toBe(true);
  });

  it("completes run and emits title generation effect on run_end", () => {
    const state = {
      ...createInitialRunMachineState(),
      phase: "active" as const,
      activeRunId: "run-1",
    };

    const next = transitionRunMachine(state, makeContext(), {
      now: 200,
      event: {
        event: "run_end",
        data: { run_id: "run-1", session_id: "session-1", status: "completed" },
      },
      mapAgentMessageToChatMessage: () => null,
    });

    expect(next.state.phase).toBe("completed");
    expect(next.state.activeRunId).toBeNull();
    expect(next.effects.some((effect) => effect.type === "title/maybe-generate")).toBe(true);
  });
});
