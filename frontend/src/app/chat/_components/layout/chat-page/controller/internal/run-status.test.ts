import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/types";
import { buildRunStatusText, pickThinkingPhrase } from "./run-status";

const assistantToolMessage = (toolCallId: string, toolName: string, input: unknown): ChatMessage => ({
  id: `assistant-${toolCallId}`,
  role: "assistant",
  parts: [
    {
      type: "dynamic-tool",
      toolCallId,
      toolName,
      input,
      state: "input-available",
    },
  ],
});

describe("run-status", () => {
  it("returns empty text when run is not loading", () => {
    const value = buildRunStatusText({
      isLoading: false,
      streamStalled: false,
      elapsedSeconds: 0,
      executingTools: new Set(),
      toolResultsMap: new Map(),
      messages: [],
    });
    expect(value).toBe("");
  });

  it("cycles friendly thinking phrases while model is thinking", () => {
    const first = pickThinkingPhrase(0);
    const second = pickThinkingPhrase(2);
    expect(first).not.toEqual(second);
  });

  it("shows a stalled status with elapsed time", () => {
    const value = buildRunStatusText({
      isLoading: true,
      streamStalled: true,
      elapsedSeconds: 125,
      executingTools: new Set(),
      toolResultsMap: new Map(),
      messages: [],
    });
    expect(value).toContain("Still cooking...");
    expect(value).toContain("2:05");
  });

  it("formats website search tool calls in one line with target", () => {
    const value = buildRunStatusText({
      isLoading: true,
      streamStalled: false,
      elapsedSeconds: 3,
      executingTools: new Set(["tool-1"]),
      toolResultsMap: new Map(),
      messages: [assistantToolMessage("tool-1", "web_search", { query: "docs.vllm.ai" })],
    });
    expect(value).toBe("searched website: docs.vllm.ai");
  });

  it("formats file creation tool calls in one line with target", () => {
    const value = buildRunStatusText({
      isLoading: true,
      streamStalled: false,
      elapsedSeconds: 8,
      executingTools: new Set(["tool-2"]),
      toolResultsMap: new Map(),
      messages: [
        assistantToolMessage("tool-2", "create_file", {
          path: "notes/quantization-plan.md",
        }),
      ],
    });
    expect(value).toBe("created file: notes/quantization-plan.md");
  });
});
