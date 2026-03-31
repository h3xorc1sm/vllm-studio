// CRITICAL
import { describe, expect, it } from "bun:test";
import {
  createAnthropicStream,
  translateRequestToOpenAI,
  translateResponseToAnthropic,
} from "../modules/proxy/anthropic-adapter";
import type { AnthropicRequest } from "../modules/proxy/anthropic-adapter";

// ── Helpers ──

const collectStream = async (stream: ReadableStream<Uint8Array>): Promise<string> => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "";
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    output += decoder.decode(result.value);
  }
  return output;
};

interface AnthropicSseEvent {
  event: string;
  data: Record<string, unknown>;
}

const parseAnthropicSseEvents = (output: string): AnthropicSseEvent[] => {
  const events: AnthropicSseEvent[] = [];
  let currentEvent = "";
  let currentData = "";
  for (const rawLine of output.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith("event:")) {
      currentEvent = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      currentData = line.slice(5).trim();
    } else if (line === "" && currentEvent && currentData) {
      events.push({
        event: currentEvent,
        data: JSON.parse(currentData) as Record<string, unknown>,
      });
      currentEvent = "";
      currentData = "";
    }
  }
  return events;
};

// ── translateRequestToOpenAI ──

describe("translateRequestToOpenAI", () => {
  it("translates simple text messages", () => {
    const req: AnthropicRequest = {
      model: "test-model",
      max_tokens: 100,
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ],
    };
    const result = translateRequestToOpenAI(req);
    const messages = result["messages"] as Array<Record<string, unknown>>;
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: "user", content: "Hello" });
    expect(messages[1]).toEqual({ role: "assistant", content: "Hi there" });
    expect(result["max_tokens"]).toBe(100);
  });

  it("prepends system prompt as string", () => {
    const req: AnthropicRequest = {
      model: "test-model",
      max_tokens: 100,
      system: "You are helpful.",
      messages: [{ role: "user", content: "Hello" }],
    };
    const result = translateRequestToOpenAI(req);
    const messages = result["messages"] as Array<Record<string, unknown>>;
    expect(messages[0]).toEqual({ role: "system", content: "You are helpful." });
    expect(messages[1]).toEqual({ role: "user", content: "Hello" });
  });

  it("prepends system prompt as ContentBlock array", () => {
    const req: AnthropicRequest = {
      model: "test-model",
      max_tokens: 100,
      system: [{ type: "text", text: "You are helpful." }],
      messages: [{ role: "user", content: "Hello" }],
    };
    const result = translateRequestToOpenAI(req);
    const messages = result["messages"] as Array<Record<string, unknown>>;
    expect(messages[0]).toEqual({ role: "system", content: "You are helpful." });
  });

  it("translates tool_use blocks to OpenAI tool_calls", () => {
    const req: AnthropicRequest = {
      model: "test-model",
      max_tokens: 100,
      messages: [
        {
          role: "assistant",
          content: [
            { type: "text", text: "Let me check." },
            { type: "tool_use", id: "toolu_123", name: "weather", input: { city: "Paris" } },
          ],
        },
      ],
    };
    const result = translateRequestToOpenAI(req);
    const messages = result["messages"] as Array<Record<string, unknown>>;
    const msg = messages[0];
    expect(msg["role"]).toBe("assistant");
    expect(msg["content"]).toBe("Let me check.");
    const toolCalls = msg["tool_calls"] as Array<Record<string, unknown>>;
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]["id"]).toBe("toolu_123");
    const fn = toolCalls[0]["function"] as Record<string, string>;
    expect(fn["name"]).toBe("weather");
    expect(JSON.parse(fn["arguments"])).toEqual({ city: "Paris" });
  });

  it("translates multiple tool_result blocks to separate role:tool messages", () => {
    const req: AnthropicRequest = {
      model: "test-model",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "toolu_1", content: "Result 1" },
            { type: "tool_result", tool_use_id: "toolu_2", content: "Result 2" },
          ],
        },
      ],
    };
    const result = translateRequestToOpenAI(req);
    const messages = result["messages"] as Array<Record<string, unknown>>;
    // No user message content (no text blocks), plus two tool messages
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: "tool", tool_call_id: "toolu_1", content: "Result 1" });
    expect(messages[1]).toEqual({ role: "tool", tool_call_id: "toolu_2", content: "Result 2" });
  });

  it("translates image content blocks to OpenAI image_url parts", () => {
    const req: AnthropicRequest = {
      model: "test-model",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What is this?" },
            {
              type: "image",
              source: { type: "base64", media_type: "image/png", data: "abc123" },
            },
          ],
        },
      ],
    };
    const result = translateRequestToOpenAI(req);
    const messages = result["messages"] as Array<Record<string, unknown>>;
    const content = messages[0]["content"] as Array<Record<string, unknown>>;
    expect(content).toHaveLength(2);
    expect(content[0]).toEqual({ type: "text", text: "What is this?" });
    expect(content[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/png;base64,abc123" },
    });
  });

  it("translates tools array to OpenAI function format", () => {
    const req: AnthropicRequest = {
      model: "test-model",
      max_tokens: 100,
      messages: [{ role: "user", content: "Hello" }],
      tools: [
        {
          name: "weather",
          description: "Get weather",
          input_schema: { type: "object", properties: { city: { type: "string" } } },
        },
      ],
    };
    const result = translateRequestToOpenAI(req);
    const tools = result["tools"] as Array<Record<string, unknown>>;
    expect(tools).toHaveLength(1);
    expect(tools[0]["type"]).toBe("function");
    const fn = tools[0]["function"] as Record<string, unknown>;
    expect(fn["name"]).toBe("weather");
    expect(fn["description"]).toBe("Get weather");
    expect(fn["parameters"]).toEqual({ type: "object", properties: { city: { type: "string" } } });
  });

  it("omits tool_choice when auto", () => {
    const req: AnthropicRequest = {
      model: "test-model",
      max_tokens: 100,
      messages: [{ role: "user", content: "Hello" }],
      tool_choice: { type: "auto" },
    };
    const result = translateRequestToOpenAI(req);
    expect(result["tool_choice"]).toBeUndefined();
  });

  it("maps tool_choice any to required", () => {
    const req: AnthropicRequest = {
      model: "test-model",
      max_tokens: 100,
      messages: [{ role: "user", content: "Hello" }],
      tool_choice: { type: "any" },
    };
    const result = translateRequestToOpenAI(req);
    expect(result["tool_choice"]).toBe("required");
  });

  it("maps tool_choice tool to function name object", () => {
    const req: AnthropicRequest = {
      model: "test-model",
      max_tokens: 100,
      messages: [{ role: "user", content: "Hello" }],
      tool_choice: { type: "tool", name: "weather" },
    };
    const result = translateRequestToOpenAI(req);
    expect(result["tool_choice"]).toEqual({
      type: "function",
      function: { name: "weather" },
    });
  });

  it("maps stop_sequences to stop", () => {
    const req: AnthropicRequest = {
      model: "test-model",
      max_tokens: 100,
      messages: [{ role: "user", content: "Hello" }],
      stop_sequences: ["\n\n", "END"],
    };
    const result = translateRequestToOpenAI(req);
    expect(result["stop"]).toEqual(["\n\n", "END"]);
  });

  it("handles mixed text and tool_use in same assistant message", () => {
    const req: AnthropicRequest = {
      model: "test-model",
      max_tokens: 100,
      messages: [
        {
          role: "assistant",
          content: [
            { type: "text", text: "Checking..." },
            { type: "tool_use", id: "toolu_1", name: "search", input: { q: "test" } },
            { type: "text", text: " more text" },
          ],
        },
      ],
    };
    const result = translateRequestToOpenAI(req);
    const messages = result["messages"] as Array<Record<string, unknown>>;
    expect(messages[0]["content"]).toBe("Checking... more text");
    const toolCalls = messages[0]["tool_calls"] as Array<Record<string, unknown>>;
    expect(toolCalls).toHaveLength(1);
    expect((toolCalls[0]["function"] as Record<string, string>)["name"]).toBe("search");
  });

  it("drops metadata field", () => {
    const req: AnthropicRequest = {
      model: "test-model",
      max_tokens: 100,
      messages: [{ role: "user", content: "Hello" }],
      metadata: { user_id: "abc" },
    };
    const result = translateRequestToOpenAI(req);
    expect(result["metadata"]).toBeUndefined();
  });
});

// ── translateResponseToAnthropic ──

describe("translateResponseToAnthropic", () => {
  it("translates simple text response", () => {
    const openaiResp = {
      choices: [
        {
          message: { role: "assistant", content: "Hello!" },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    };
    const result = translateResponseToAnthropic(openaiResp, "test-model");
    expect(result.type).toBe("message");
    expect(result.role).toBe("assistant");
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({ type: "text", text: "Hello!" });
    expect(result.stop_reason).toBe("end_turn");
    expect(result.usage).toEqual({ input_tokens: 10, output_tokens: 5 });
  });

  it("translates tool calls response", () => {
    const openaiResp = {
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call_123",
                type: "function",
                function: { name: "weather", arguments: '{"city":"Paris"}' },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    };
    const result = translateResponseToAnthropic(openaiResp, "test-model");
    expect(result.content).toHaveLength(1);
    expect(result.content[0]["type"]).toBe("tool_use");
    expect((result.content[0] as Record<string, unknown>)["name"]).toBe("weather");
    expect((result.content[0] as Record<string, unknown>)["input"]).toEqual({ city: "Paris" });
    expect(result.stop_reason).toBe("tool_use");
  });

  it("handles both text and tool calls", () => {
    const openaiResp = {
      choices: [
        {
          message: {
            role: "assistant",
            content: "Let me check.",
            tool_calls: [
              {
                id: "call_456",
                type: "function",
                function: { name: "search", arguments: '{"q":"test"}' },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 15 },
    };
    const result = translateResponseToAnthropic(openaiResp, "test-model");
    expect(result.content).toHaveLength(2);
    expect(result.content[0]).toEqual({ type: "text", text: "Let me check." });
    expect(result.content[1]["type"]).toBe("tool_use");
  });

  it("maps finish_reason stop to end_turn", () => {
    const openaiResp = {
      choices: [{ message: { role: "assistant", content: "Done" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    };
    const result = translateResponseToAnthropic(openaiResp, "test-model");
    expect(result.stop_reason).toBe("end_turn");
  });

  it("maps finish_reason tool_calls to tool_use", () => {
    const openaiResp = {
      choices: [
        {
          message: { role: "assistant", content: null, tool_calls: [{ id: "x", function: { name: "f", arguments: "{}" } }] },
          finish_reason: "tool_calls",
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    };
    const result = translateResponseToAnthropic(openaiResp, "test-model");
    expect(result.stop_reason).toBe("tool_use");
  });

  it("maps finish_reason length to max_tokens", () => {
    const openaiResp = {
      choices: [{ message: { role: "assistant", content: "..." }, finish_reason: "length" }],
      usage: { prompt_tokens: 1, completion_tokens: 100 },
    };
    const result = translateResponseToAnthropic(openaiResp, "test-model");
    expect(result.stop_reason).toBe("max_tokens");
  });

  it("maps usage tokens correctly", () => {
    const openaiResp = {
      choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 42, completion_tokens: 7 },
    };
    const result = translateResponseToAnthropic(openaiResp, "test-model");
    expect(result.usage.input_tokens).toBe(42);
    expect(result.usage.output_tokens).toBe(7);
  });

  it("handles null content with tool calls", () => {
    const openaiResp = {
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{ id: "tc_1", function: { name: "act", arguments: "{}" } }],
          },
          finish_reason: "tool_calls",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    };
    const result = translateResponseToAnthropic(openaiResp, "test-model");
    expect(result.content).toHaveLength(1);
    expect(result.content[0]["type"]).toBe("tool_use");
    expect((result.content[0] as Record<string, unknown>)["name"]).toBe("act");
  });
});

// ── createAnthropicStream ──

describe("createAnthropicStream", () => {
  it("emits correct Anthropic SSE event sequence for text streaming", async () => {
    const encoder = new TextEncoder();
    const source = new ReadableStream<Uint8Array>({
      start(controller): void {
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'
          )
        );
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":" world"}}]}\n\n'
          )
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    const stream = createAnthropicStream(source.getReader(), "test-model");
    const output = await collectStream(stream);
    const events = parseAnthropicSseEvents(output);

    const eventTypes = events.map((e) => e.event);
    expect(eventTypes).toContain("message_start");
    expect(eventTypes).toContain("content_block_start");
    expect(eventTypes).toContain("content_block_delta");
    expect(eventTypes).toContain("content_block_stop");
    expect(eventTypes).toContain("message_delta");
    expect(eventTypes).toContain("message_stop");

    // Verify message_start structure
    const msgStart = events.find((e) => e.event === "message_start");
    expect(msgStart?.data["type"]).toBe("message_start");
    const msg = msgStart?.data["message"] as Record<string, unknown>;
    expect(msg["type"]).toBe("message");
    expect(msg["role"]).toBe("assistant");

    // Verify text deltas
    const textDeltas = events.filter(
      (e) => e.event === "content_block_delta"
    );
    const collectedText = textDeltas
      .map((e) => ((e.data["delta"] as Record<string, unknown>)["text"] as string))
      .join("");
    expect(collectedText).toBe("Hello world");
  });

  it("emits input_json_delta events for tool call streaming", async () => {
    const encoder = new TextEncoder();
    const source = new ReadableStream<Uint8Array>({
      start(controller): void {
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"weather","arguments":""}}]}}]}\n\n'
          )
        );
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"city\\""}}]}}]}\n\n'
          )
        );
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":":\\"Paris\\"}"}}]}}]}\n\n'
          )
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    const stream = createAnthropicStream(source.getReader(), "test-model");
    const output = await collectStream(stream);
    const events = parseAnthropicSseEvents(output);

    const eventTypes = events.map((e) => e.event);
    expect(eventTypes).toContain("content_block_start");

    // Find content_block_start for tool_use
    const toolBlockStart = events.find(
      (e) =>
        e.event === "content_block_start" &&
        ((e.data["content_block"] as Record<string, unknown>)?.["type"] === "tool_use")
    );
    expect(toolBlockStart).toBeDefined();
    const contentBlock = toolBlockStart!.data["content_block"] as Record<string, unknown>;
    expect(contentBlock["name"]).toBe("weather");

    // Verify input_json_delta contains accumulated arguments
    const jsonDeltas = events.filter(
      (e) =>
        e.event === "content_block_delta" &&
        ((e.data["delta"] as Record<string, unknown>)?.["type"] === "input_json_delta")
    );
    const accumulated = jsonDeltas
      .map((e) => ((e.data["delta"] as Record<string, unknown>)["partial_json"] as string))
      .join("");
    expect(accumulated).toBe('{"city":"Paris"}');

    // Stop reason should be tool_use
    const msgDelta = events.find((e) => e.event === "message_delta");
    const delta = msgDelta?.data["delta"] as Record<string, unknown>;
    expect(delta["stop_reason"]).toBe("tool_use");
  });

  it("calls onUsage callback with usage data", async () => {
    const encoder = new TextEncoder();
    let capturedUsage: { prompt_tokens: number; completion_tokens: number } | null = null;

    const source = new ReadableStream<Uint8Array>({
      start(controller): void {
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"hi"}}],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n'
          )
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    const stream = createAnthropicStream(source.getReader(), "test-model", undefined, (usage) => {
      capturedUsage = usage;
    });
    await collectStream(stream);
    expect(capturedUsage).not.toBeNull();
    expect(capturedUsage!.prompt_tokens).toBe(10);
    expect(capturedUsage!.completion_tokens).toBe(5);
  });

  it("terminates with message_stop on data: [DONE]", async () => {
    const encoder = new TextEncoder();
    const source = new ReadableStream<Uint8Array>({
      start(controller): void {
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"end"}}]}\n\n')
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    const stream = createAnthropicStream(source.getReader(), "test-model");
    const output = await collectStream(stream);
    const events = parseAnthropicSseEvents(output);

    expect(events.at(-1)?.event).toBe("message_stop");
    expect(events.map((e) => e.event)).toContain("message_delta");
  });
});
