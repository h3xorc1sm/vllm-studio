// CRITICAL
import { randomUUID } from "node:crypto";

// ── Anthropic Types ──

export interface AnthropicTextBlock {
  type: "text";
  text: string;
}

export interface AnthropicImageBlock {
  type: "image";
  source: {
    type: string;
    media_type?: string;
    data?: string;
    url?: string;
  };
}

export interface AnthropicToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AnthropicToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content?: string | AnthropicTextBlock[];
  is_error?: boolean;
}

export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicImageBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

export interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string | AnthropicTextBlock[];
  tools?: AnthropicTool[];
  tool_choice?: { type: "auto" } | { type: "any" } | { type: "tool"; name: string };
  stop_sequences?: string[];
  stream?: boolean;
  metadata?: unknown;
  temperature?: number;
  top_p?: number;
  top_k?: number;
}

export interface AnthropicMessageResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: { input_tokens: number; output_tokens: number };
}

// ── Request Translation ──

export const translateRequestToOpenAI = (req: AnthropicRequest): Record<string, unknown> => {
  const messages: Array<Record<string, unknown>> = [];

  // System prompt → prepended system message
  if (req.system) {
    const systemText =
      typeof req.system === "string"
        ? req.system
        : req.system
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\n");
    if (systemText) {
      messages.push({ role: "system", content: systemText });
    }
  }

  // Translate messages
  for (const msg of req.messages) {
    if (typeof msg.content === "string") {
      messages.push({ role: msg.role, content: msg.content });
      continue;
    }

    const blocks = msg.content as AnthropicContentBlock[];
    const textParts: string[] = [];
    const toolCalls: Array<{ index: number; id: string; type: "function"; function: { name: string; arguments: string } }> = [];
    const toolResults: AnthropicToolResultBlock[] = [];
    const imageParts: Array<{ type: "image_url"; image_url: { url: string } }> = [];

    for (const block of blocks) {
      if (block.type === "text") {
        textParts.push((block as AnthropicTextBlock).text);
      } else if (block.type === "tool_use") {
        const tu = block as AnthropicToolUseBlock;
        toolCalls.push({
          index: toolCalls.length,
          id: tu.id,
          type: "function",
          function: { name: tu.name, arguments: JSON.stringify(tu.input) },
        });
      } else if (block.type === "tool_result") {
        toolResults.push(block as AnthropicToolResultBlock);
      } else if (block.type === "image") {
        const img = block as AnthropicImageBlock;
        let url = "";
        if (img.source.type === "url" && img.source.url) {
          url = img.source.url;
        } else if (img.source.type === "base64" && img.source.data && img.source.media_type) {
          url = `data:${img.source.media_type};base64,${img.source.data}`;
        }
        if (url) {
          imageParts.push({ type: "image_url", image_url: { url } });
        }
      }
    }

    // Emit the main message
    if (msg.role === "assistant") {
      const assistantMsg: Record<string, unknown> = { role: "assistant" };

      // Content: text parts + image parts
      if (textParts.length > 0 || imageParts.length > 0) {
        if (imageParts.length > 0) {
          const contentParts: Array<Record<string, unknown>> = [];
          for (const t of textParts) contentParts.push({ type: "text", text: t });
          contentParts.push(...imageParts);
          assistantMsg["content"] = contentParts;
        } else {
          assistantMsg["content"] = textParts.join("");
        }
      } else {
        assistantMsg["content"] = null;
      }

      if (toolCalls.length > 0) {
        assistantMsg["tool_calls"] = toolCalls;
      }

      messages.push(assistantMsg);
    } else {
      // User message
      if (imageParts.length > 0) {
        const contentParts: Array<Record<string, unknown>> = [];
        for (const t of textParts) contentParts.push({ type: "text", text: t });
        contentParts.push(...imageParts);
        messages.push({ role: "user", content: contentParts });
      } else if (textParts.length > 0) {
        messages.push({ role: "user", content: textParts.join("") });
      }
    }

    // tool_result blocks → separate role: "tool" messages
    for (const tr of toolResults) {
      const toolContent =
        typeof tr.content === "string"
          ? tr.content
          : Array.isArray(tr.content)
            ? tr.content
                .filter((b) => b.type === "text")
                .map((b) => b.text)
                .join("")
            : "";
      messages.push({
        role: "tool",
        tool_call_id: tr.tool_use_id,
        content: toolContent,
      });
    }
  }

  const openaiReq: Record<string, unknown> = {
    model: req.model,
    messages,
    max_tokens: req.max_tokens,
  };

  // Tools translation
  if (req.tools && req.tools.length > 0) {
    openaiReq["tools"] = req.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));
  }

  // Tool choice translation
  if (req.tool_choice) {
    if (req.tool_choice.type === "auto") {
      // Omit — let backend default to auto
    } else if (req.tool_choice.type === "any") {
      openaiReq["tool_choice"] = "required";
    } else if (req.tool_choice.type === "tool") {
      openaiReq["tool_choice"] = { type: "function", function: { name: req.tool_choice.name } };
    }
  }

  // Stop sequences
  if (req.stop_sequences && req.stop_sequences.length > 0) {
    openaiReq["stop"] = req.stop_sequences;
  }

  // Pass through optional params
  if (req.temperature !== undefined) openaiReq["temperature"] = req.temperature;
  if (req.top_p !== undefined) openaiReq["top_p"] = req.top_p;
  if (req.stream !== undefined) openaiReq["stream"] = req.stream;

  // metadata is intentionally dropped

  return openaiReq;
};

// ── Response Translation ──

export const translateResponseToAnthropic = (
  openaiResp: Record<string, unknown>,
  model: string,
  stopSequences?: string[]
): AnthropicMessageResponse => {
  const choices = openaiResp["choices"] as Array<Record<string, unknown>> | undefined;
  const choice = choices?.[0];
  const message = choice?.["message"] as Record<string, unknown> | undefined;
  const usage = openaiResp["usage"] as Record<string, unknown> | undefined;

  const content: AnthropicMessageResponse["content"] = [];

  // Thinking content — check reasoning fields first, then parse <think/> tags from content
  const rawReasoningField =
    typeof message?.["reasoning_content"] === "string" ? String(message["reasoning_content"]) :
    typeof message?.["reasoning"] === "string" ? String(message["reasoning"]) : "";
  const rawContentField = typeof message?.["content"] === "string" ? String(message["content"]) : "";

  // Extract <think/>, <thinking/>, <analysis/> blocks from content as fallback
  let extractedReasoning = "";
  let cleanedContent = rawContentField;
  const thinkRegex = /<(?:think|thinking|analysis)(?:\s+[^>]*)?>[\s\S]*?<\/(?:think|thinking|analysis)>/gi;
  // Also handle unclosed think tags (model may not close them)
  const thinkOpenRegex = /<(?:think|thinking|analysis)(?:\s+[^>]*)?>[\s\S]*$/gi;

  const thinkBlocks: string[] = [];
  let matchResult = rawContentField.replace(thinkRegex, (_, tag) => {
    thinkBlocks.push(tag);
    return "";
  });
  // Check for unclosed think tags
  const unclosedMatch = matchResult.match(thinkOpenRegex);
  if (unclosedMatch) {
    for (const m of unclosedMatch) {
      const inner = m.replace(/^<(?:think|thinking|analysis)(?:\s+[^>]*)?>/i, "");
      thinkBlocks.push(inner);
    }
    matchResult = matchResult.replace(thinkOpenRegex, "");
  }
  cleanedContent = matchResult.trim();
  extractedReasoning = thinkBlocks.join("\n");

  // Combine: reasoning field + extracted from content
  const allReasoning = [rawReasoningField, extractedReasoning].filter(r => r.trim()).join("\n");
  if (allReasoning) {
    content.push({ type: "thinking", thinking: allReasoning } as unknown as AnthropicMessageResponse["content"][number]);
  }

  // Text content (cleaned of think tags)
  if (cleanedContent) {
    content.push({ type: "text", text: cleanedContent });
  }

  // Tool calls
  const toolCalls = message?.["tool_calls"] as
    | Array<{ id?: string; function?: { name?: string; arguments?: string } }>
    | undefined;
  if (Array.isArray(toolCalls)) {
    for (const tc of toolCalls) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(tc.function?.arguments ?? "{}");
      } catch {
        input = {};
      }
      content.push({
        type: "tool_use",
        id: tc.id ?? `toolu_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
        name: tc.function?.name ?? "",
        input,
      });
    }
  }

  // finish_reason mapping
  const finishReason = choice?.["finish_reason"];
  let stopReason = "end_turn";
  if (finishReason === "tool_calls" || finishReason === "function_call") {
    stopReason = "tool_use";
  } else if (finishReason === "length") {
    stopReason = "max_tokens";
  }

  // Detect stop sequence match
  const lastText = content.find((c) => c.type === "text" && "text" in c);
  let stopSequence: string | null = null;
  if (stopSequences?.length && lastText && "text" in lastText) {
    for (const seq of stopSequences) {
      if ((lastText as { text: string }).text.endsWith(seq)) {
        stopSequence = seq;
        stopReason = "stop_sequence";
        break;
      }
    }
  }

  return {
    id: `msg_${randomUUID().replace(/-/g, "")}`,
    type: "message",
    role: "assistant",
    content,
    model,
    stop_reason: stopReason,
    stop_sequence: stopSequence,
    usage: {
      input_tokens: Number(usage?.["prompt_tokens"] ?? 0),
      output_tokens: Number(usage?.["completion_tokens"] ?? 0),
    },
  };
};

// ── Streaming Translation ──

export interface AnthropicStreamUsage {
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens?: number;
}

export const createAnthropicStream = (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  model: string,
  stopSequences?: string[],
  onUsage?: (usage: AnthropicStreamUsage) => void
): ReadableStream<Uint8Array> => {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const messageId = `msg_${randomUUID().replace(/-/g, "")}`;
  let buffer = "";
  let messageStarted = false;
  let currentBlockIndex = 0;
  let outputTokens = 0;
  let usageTracked = false;

  // Tool call accumulation
  const toolCallAccumulators: Map<number, { id: string; name: string; arguments: string }> = new Map();

  const enqueue = (controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown): void => {
    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  };

  const emitMessageStart = (controller: ReadableStreamDefaultController<Uint8Array>): void => {
    enqueue(controller, "message_start", {
      type: "message_start",
      message: {
        id: messageId,
        type: "message",
        role: "assistant",
        content: [],
        model,
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      },
    });
    messageStarted = true;
  };

  const emitToolUseBlocks = (controller: ReadableStreamDefaultController<Uint8Array>): void => {
    for (const [, tc] of toolCallAccumulators) {
      if (!messageStarted) emitMessageStart(controller);

      const blockIndex = currentBlockIndex;

      // Start tool_use block
      enqueue(controller, "content_block_start", {
        type: "content_block_start",
        index: blockIndex,
        content_block: { type: "tool_use", id: tc.id, name: tc.name, input: {} },
      });

      // Delta with full arguments
      if (tc.arguments) {
        enqueue(controller, "content_block_delta", {
          type: "content_block_delta",
          index: blockIndex,
          delta: { type: "input_json_delta", partial_json: tc.arguments },
        });
      }

      enqueue(controller, "content_block_stop", {
        type: "content_block_stop",
        index: blockIndex,
      });

      currentBlockIndex += 1;
    }
  };

  const emitMessageEnd = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    stopReason: string
  ): void => {
    // Emit any accumulated tool use blocks before ending
    emitToolUseBlocks(controller);

    if (!messageStarted) emitMessageStart(controller);

    enqueue(controller, "message_delta", {
      type: "message_delta",
      delta: { stop_reason: stopReason, stop_sequence: null },
      usage: { output_tokens: outputTokens },
    });

    enqueue(controller, "message_stop", {
      type: "message_stop",
    });
  };

  const parseUsage = (data: Record<string, unknown>): void => {
    if (usageTracked || !onUsage) return;
    const usage = data["usage"] as Record<string, unknown> | undefined;
    if (usage && (usage["prompt_tokens"] || usage["completion_tokens"])) {
      const details = usage["prompt_tokens_details"] as Record<string, unknown> | undefined;
      const rawCached = details?.["cached_tokens"];
      onUsage({
        prompt_tokens: Number(usage["prompt_tokens"] ?? 0),
        completion_tokens: Number(usage["completion_tokens"] ?? 0),
        cached_tokens: rawCached != null ? Number(rawCached) : undefined,
      });
      usageTracked = true;
    }
  };

  // Track state for progressive streaming
  let hasToolCalls = false;
  let thinkingBlockOpen = false;
  let textBlockOpen = false;
  let accumulatedText = ""; // only for stop sequence detection

  // Think-tag parsing state (carries across chunks since tags can span deltas)
  const thinkingOpenPrefixes = ["<thinking", "<analysis", "<think"];
  const thinkingClosePrefixes = ["</thinking", "</analysis", "</think"];
  const thinkingAllPrefixes = [...thinkingOpenPrefixes, ...thinkingClosePrefixes];
  let inThink = false;
  let thinkCarry = "";

  const getThinkingTagLength = (suffix: string): { kind: "open" | "close"; length: number } | null => {
    if (!suffix.startsWith("<")) return null;
    const closeIndex = suffix.indexOf(">");
    if (closeIndex < 0) return null;
    const tag = suffix.slice(0, closeIndex + 1);
    if (/^<(think|thinking|analysis)(?:\s+[^>]*)?>$/i.test(tag))
      return { kind: "open", length: closeIndex + 1 };
    if (/^<\/(think|thinking|analysis)(?:\s+[^>]*)?>$/i.test(tag))
      return { kind: "close", length: closeIndex + 1 };
    return null;
  };

  const isThinkingTag = (suffix: string): { kind: "open" | "close"; length: number } | null => {
    return getThinkingTagLength(suffix);
  };

  const thinkingTagPrefixIsPartial = (suffix: string): boolean => {
    const lower = suffix.toLowerCase();
    if (!lower.startsWith("<")) return false;
    for (const prefix of thinkingAllPrefixes) {
      if (prefix.startsWith(lower)) return true;
      if (lower.startsWith(prefix)) {
        const next = lower[prefix.length];
        if (!next) return true;
        if (next === ">" || next === " " || next === "/" || next === "\t" || next === "\n" || next === "\r")
          return true;
      }
    }
    return false;
  };

  /** Parse think tags from a streaming delta, splitting into reasoning and content. */
  const rewriteThinkDelta = (deltaText: string): { content: string; reasoning: string } => {
    const combined = thinkCarry + (deltaText ?? "");
    const combinedLower = combined.toLowerCase();
    let carryIndex = combined.length;
    let index = 0;
    let contentOut = "";
    let reasoningOut = "";

    while (index < carryIndex) {
      const remainingLower = combinedLower.slice(index);

      if (combined[index] === "<") {
        const thinkTag = isThinkingTag(remainingLower);
        if (thinkTag?.kind === "open") {
          inThink = true;
          index += thinkTag.length;
          continue;
        }
        if (thinkTag?.kind === "close") {
          inThink = false;
          index += thinkTag.length;
          continue;
        }
        if (thinkingTagPrefixIsPartial(remainingLower)) {
          carryIndex = index;
          break;
        }
      }

      const ch = combined[index] ?? "";
      if (inThink) {
        reasoningOut += ch;
      } else {
        contentOut += ch;
      }
      index += 1;
    }

    thinkCarry = carryIndex < combined.length ? combined.slice(carryIndex) : "";

    return { content: contentOut, reasoning: reasoningOut };
  };

  /** Flush any remaining think carry buffer at stream end. */
  const flushThinkCarry = (): { content: string; reasoning: string } => {
    if (!thinkCarry) return { content: "", reasoning: "" };
    const remaining = thinkCarry;
    thinkCarry = "";
    if (inThink) {
      return { content: "", reasoning: remaining };
    }
    return { content: remaining, reasoning: "" };
  };

  // Start/close helpers for progressive blocks
  const startThinkingBlock = (controller: ReadableStreamDefaultController<Uint8Array>): void => {
    if (!messageStarted) emitMessageStart(controller);
    enqueue(controller, "content_block_start", {
      type: "content_block_start",
      index: currentBlockIndex,
      content_block: { type: "thinking", thinking: "" },
    });
    thinkingBlockOpen = true;
  };

  const closeThinkingBlock = (controller: ReadableStreamDefaultController<Uint8Array>): void => {
    if (!thinkingBlockOpen) return;
    enqueue(controller, "content_block_stop", {
      type: "content_block_stop",
      index: currentBlockIndex,
    });
    currentBlockIndex += 1;
    thinkingBlockOpen = false;
  };

  const startTextBlock = (controller: ReadableStreamDefaultController<Uint8Array>): void => {
    if (!messageStarted) emitMessageStart(controller);
    enqueue(controller, "content_block_start", {
      type: "content_block_start",
      index: currentBlockIndex,
      content_block: { type: "text", text: "" },
    });
    textBlockOpen = true;
  };

  const closeTextBlock = (controller: ReadableStreamDefaultController<Uint8Array>): void => {
    if (!textBlockOpen) return;
    enqueue(controller, "content_block_stop", {
      type: "content_block_stop",
      index: currentBlockIndex,
    });
    currentBlockIndex += 1;
    textBlockOpen = false;
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller): Promise<void> {
      const processChunk = (data: Record<string, unknown>): void => {
        parseUsage(data);

        const choices = data["choices"];
        if (!Array.isArray(choices)) return;
        const choice = choices[0] as Record<string, unknown> | undefined;
        if (!choice) return;

        const delta = (choice["delta"] ?? choice["message"]) as Record<string, unknown> | undefined;
        if (!delta) return;

        // Parse think tags from delta.content (vLLM sends thinking inside <think/> in content)
        const rawContent = typeof delta["content"] === "string" ? String(delta["content"]) : "";
        const rawReasoning = typeof (delta["reasoning_content"] ?? delta["reasoning"]) === "string"
          ? String(delta["reasoning_content"] ?? delta["reasoning"])
          : "";

        // Rewrite content through think-tag parser, also check reasoning fields as fallback
        const { content: parsedContent, reasoning: parsedReasoning } = rewriteThinkDelta(rawContent);
        const reasoning = parsedReasoning || rawReasoning;
        const textContent = parsedContent;

        if (reasoning) {
          closeTextBlock(controller);
          if (!thinkingBlockOpen) startThinkingBlock(controller);
          enqueue(controller, "content_block_delta", {
            type: "content_block_delta",
            index: currentBlockIndex,
            delta: { type: "thinking_delta", thinking: reasoning },
          });
          accumulatedText += reasoning;
        }

        if (textContent) {
          closeThinkingBlock(controller);
          if (!textBlockOpen) startTextBlock(controller);
          enqueue(controller, "content_block_delta", {
            type: "content_block_delta",
            index: currentBlockIndex,
            delta: { type: "text_delta", text: textContent },
          });
          accumulatedText += textContent;
        }

        // Handle tool calls — accumulate arguments
        const toolCalls = delta["tool_calls"] as
          | Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>
          | undefined;
        if (Array.isArray(toolCalls)) {
          hasToolCalls = true;
          // Close any open blocks before tool calls
          closeThinkingBlock(controller);
          closeTextBlock(controller);
          for (const tc of toolCalls) {
            const idx = tc.index ?? 0;
            if (!toolCallAccumulators.has(idx)) {
              toolCallAccumulators.set(idx, {
                id: tc.id ?? `toolu_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
                name: tc.function?.name ?? "",
                arguments: "",
              });
            }
            const acc = toolCallAccumulators.get(idx)!;
            if (tc.function?.name) acc.name = tc.function.name;
            if (tc.function?.arguments) acc.arguments += tc.function.arguments;
          }
        }

        // Track output tokens from usage in streaming chunks
        const chunkUsage = data["usage"] as Record<string, unknown> | undefined;
        if (chunkUsage?.["completion_tokens"]) {
          outputTokens = Number(chunkUsage["completion_tokens"]);
        }
      };

      const processDone = (controller: ReadableStreamDefaultController<Uint8Array>): void => {
        // Flush any remaining think-tag carry buffer
        const flushed = flushThinkCarry();
        if (flushed.reasoning) {
          closeTextBlock(controller);
          if (!thinkingBlockOpen) startThinkingBlock(controller);
          enqueue(controller, "content_block_delta", {
            type: "content_block_delta",
            index: currentBlockIndex,
            delta: { type: "thinking_delta", thinking: flushed.reasoning },
          });
        }
        if (flushed.content) {
          closeThinkingBlock(controller);
          if (!textBlockOpen) startTextBlock(controller);
          enqueue(controller, "content_block_delta", {
            type: "content_block_delta",
            index: currentBlockIndex,
            delta: { type: "text_delta", text: flushed.content },
          });
        }

        // Close any open blocks
        closeThinkingBlock(controller);
        closeTextBlock(controller);

        // Determine stop reason
        let stopReason = "end_turn";
        if (hasToolCalls) {
          stopReason = "tool_use";
        } else if (stopSequences?.length) {
          for (const seq of stopSequences) {
            if (accumulatedText.endsWith(seq)) {
              stopReason = "stop_sequence";
              break;
            }
          }
        }

        emitMessageEnd(controller, stopReason);
      };

      while (true) {
        let result: ReadableStreamDefaultReadResult<Uint8Array>;
        try {
          result = await reader.read();
        } catch {
          processDone(controller);
          controller.close();
          return;
        }

        if (result.done) {
          // Process remaining buffer
          if (buffer.trim()) {
            const lines = buffer.split("\n");
            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (!data || data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data) as Record<string, unknown>;
                processChunk(parsed);
              } catch {
                // skip unparseable
              }
            }
          }
          processDone(controller);
          controller.close();
          return;
        }

        buffer += decoder.decode(result.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let foundDone = false;

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          if (data === "[DONE]") {
            foundDone = true;
            continue;
          }
          try {
            const parsed = JSON.parse(data) as Record<string, unknown>;
            processChunk(parsed);
          } catch {
            // skip unparseable
          }
        }

        if (foundDone) {
          processDone(controller);
          controller.close();
          return;
        }
      }
    },
    async cancel(): Promise<void> {
      await reader.cancel();
    },
  });
};
