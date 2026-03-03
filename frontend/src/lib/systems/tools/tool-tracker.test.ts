import { describe, expect, it } from "vitest";
import type { ToolResult } from "@/lib/types";
import {
  extractToolResultText,
  withExecutingToolEnded,
  withExecutingToolStarted,
  withToolExecutionEnd,
  withToolExecutionStart,
} from "./tool-tracker";

describe("tool-tracker", () => {
  it("extracts text content from tool arrays", () => {
    const text = extractToolResultText([
      { type: "text", text: "hello" },
      { type: "text", text: "world" },
    ]);
    expect(text).toBe("hello\nworld");
  });

  it("stores execution metadata and preserves prior content", () => {
    const prev = new Map<string, ToolResult>([
      [
        "call-1",
        {
          tool_call_id: "call-1",
          content: "prior",
        },
      ],
    ]);
    const next = withToolExecutionStart(prev, "call-1", "read_file", { path: "a.ts" });
    expect(next.get("call-1")).toEqual({
      tool_call_id: "call-1",
      content: "prior",
      name: "read_file",
      input: { path: "a.ts" },
    });
  });

  it("stores execution result and preserves metadata", () => {
    const prev = new Map<string, ToolResult>([
      [
        "call-1",
        {
          tool_call_id: "call-1",
          content: "",
          name: "read_file",
          input: { path: "a.ts" },
        },
      ],
    ]);

    const next = withToolExecutionEnd(prev, "call-1", "done", false);
    expect(next.get("call-1")).toEqual({
      tool_call_id: "call-1",
      content: "done",
      name: "read_file",
      input: { path: "a.ts" },
      isError: false,
    });
  });

  it("tracks executing tool ids", () => {
    const started = withExecutingToolStarted(new Set<string>(), "call-1");
    expect(started.has("call-1")).toBe(true);

    const ended = withExecutingToolEnded(started, "call-1");
    expect(ended.has("call-1")).toBe(false);
  });
});
