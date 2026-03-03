// CRITICAL
import { normalizePlanSteps } from "@/app/chat/_components/agent/agent-types";
import { extractToolResultText } from "@/lib/systems/tools/tool-tracker";
import type {
  RunMachineContext,
  RunMachineEffect,
  RunMachineState,
  RunMachineTransitionInput,
  RunMachineTransitionResult,
  RunMeta,
  TurnResultEntry,
} from "./types";

function parseRunMeta(data: Record<string, unknown>): {
  runId?: string;
  turnIndex?: number;
  eventSessionId?: string;
} {
  const runId = typeof data["run_id"] === "string" ? data["run_id"] : undefined;
  const turnIndex = typeof data["turn_index"] === "number" ? data["turn_index"] : undefined;
  const eventSessionId =
    typeof data["session_id"] === "string" ? data["session_id"] : undefined;
  return { runId, turnIndex, eventSessionId };
}

function shouldIgnoreEvent(args: {
  state: RunMachineState;
  context: RunMachineContext;
  eventType: string;
  runId?: string;
  eventSessionId?: string;
}): boolean {
  const { state, context, eventType, runId, eventSessionId } = args;

  if (eventSessionId && context.currentSessionId && eventSessionId !== context.currentSessionId) {
    return true;
  }

  if (!state.activeRunId) {
    if (eventType === "run_start" && runId) {
      return false;
    }
    if (!context.currentSessionId) {
      return true;
    }
    return false;
  }

  if (runId && runId !== state.activeRunId) {
    return true;
  }

  return false;
}

function createPlanFromData(planRaw: unknown) {
  if (!planRaw || typeof planRaw !== "object") return null;
  const planRecord = planRaw as Record<string, unknown>;
  const steps = normalizePlanSteps(planRecord["steps"] ?? planRecord["tasks"]);
  if (steps.length === 0) return null;
  return {
    steps,
    createdAt: typeof planRecord["createdAt"] === "number" ? planRecord["createdAt"] : Date.now(),
    updatedAt: typeof planRecord["updatedAt"] === "number" ? planRecord["updatedAt"] : Date.now(),
  };
}

function parseTurnToolResults(data: Record<string, unknown>): TurnResultEntry[] {
  const toolResults = Array.isArray(data["toolResults"]) ? data["toolResults"] : [];
  const parsed: TurnResultEntry[] = [];
  for (const result of toolResults) {
    if (!result || typeof result !== "object") continue;
    const record = result as Record<string, unknown>;
    const toolCallId = typeof record["toolCallId"] === "string" ? record["toolCallId"] : "";
    if (!toolCallId) continue;
    parsed.push({
      toolCallId,
      resultText: extractToolResultText(record["content"]),
      isError: record["isError"] === true,
    });
  }
  return parsed;
}

function extractAssistantContentForTitle(message: { parts: Array<{ type: string; text?: string }> } | null): string {
  if (!message) return "";
  const assistantText = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
  const reasoningText = message.parts
    .filter((part) => part.type === "reasoning")
    .map((part) => part.text ?? "")
    .join("");
  return assistantText || reasoningText;
}

function withState(state: RunMachineState, patch: Partial<RunMachineState>): RunMachineState {
  return { ...state, ...patch };
}

export function createInitialRunMachineState(): RunMachineState {
  return {
    phase: "idle",
    activeRunId: null,
    lastEventTime: 0,
    runCompleted: false,
  };
}

export function transitionRunMachine(
  state: RunMachineState,
  context: RunMachineContext,
  input: RunMachineTransitionInput,
): RunMachineTransitionResult {
  const { event, now, mapAgentMessageToChatMessage } = input;
  const data = event.data as Record<string, unknown>;
  const { runId, turnIndex, eventSessionId } = parseRunMeta(data);

  if (
    shouldIgnoreEvent({
      state,
      context,
      eventType: event.event,
      runId,
      eventSessionId,
    })
  ) {
    return {
      state,
      effects: [],
    };
  }

  const runMeta: RunMeta =
    typeof runId === "string" || typeof turnIndex === "number"
      ? { runId, turnIndex }
      : {};

  const baseState = withState(state, { lastEventTime: now });
  const effects: RunMachineEffect[] = [{ type: "stream/set-stalled", stalled: false }];

  switch (event.event) {
    case "run_start": {
      if (runId) {
        effects.push({ type: "stream/set-active-run-id", runId });
      }
      effects.push({ type: "stream/clear-error" });
      return {
        state: withState(baseState, {
          phase: "active",
          activeRunId: runId ?? state.activeRunId,
          runCompleted: false,
        }),
        effects,
      };
    }

    case "message_start":
    case "message_update":
    case "message_end": {
      const rawMessage = data["message"];
      if (!rawMessage || typeof rawMessage !== "object") {
        return { state: baseState, effects };
      }
      const messageId = typeof data["message_id"] === "string" ? data["message_id"] : undefined;
      const mapped = mapAgentMessageToChatMessage(
        rawMessage as Record<string, unknown>,
        messageId,
        runMeta,
      );
      if (mapped) {
        effects.push({ type: "messages/upsert", message: mapped });
      }
      if (event.event === "message_end") {
        effects.push({ type: "stream/set-loading", loading: false });
      }
      return { state: baseState, effects };
    }

    case "turn_end": {
      const rawMessage = data["message"];
      const messageId = typeof data["message_id"] === "string" ? data["message_id"] : undefined;
      const mapped =
        rawMessage && typeof rawMessage === "object"
          ? mapAgentMessageToChatMessage(rawMessage as Record<string, unknown>, messageId, runMeta)
          : null;

      effects.push({
        type: "messages/turn-finished",
        ...(mapped ? { message: mapped } : {}),
        toolResults: parseTurnToolResults(data),
        assistantContentForTitle: extractAssistantContentForTitle(mapped),
      });
      effects.push({ type: "stream/set-loading", loading: false });
      effects.push({ type: "tools/clear-executing" });
      return { state: baseState, effects };
    }

    case "agent_end": {
      effects.push({ type: "stream/set-loading", loading: false });
      effects.push({ type: "tools/clear-executing" });
      return { state: baseState, effects };
    }

    case "tool_execution_start": {
      const toolCallId = typeof data["toolCallId"] === "string" ? data["toolCallId"] : "";
      if (!toolCallId) return { state: baseState, effects };
      const toolName = typeof data["toolName"] === "string" ? data["toolName"] : toolCallId;
      effects.push({
        type: "tools/start",
        toolCallId,
        toolName,
        input: data["args"],
      });
      return { state: baseState, effects };
    }

    case "tool_execution_end": {
      const toolCallId = typeof data["toolCallId"] === "string" ? data["toolCallId"] : "";
      if (!toolCallId) return { state: baseState, effects };
      effects.push({
        type: "tools/end",
        toolCallId,
        resultText: extractToolResultText(data["result"]),
        isError: data["isError"] === true,
      });
      return { state: baseState, effects };
    }

    case "plan_updated": {
      const plan = createPlanFromData(data["plan"]);
      if (plan) {
        effects.push({ type: "plan/update", plan });
      }
      return { state: baseState, effects };
    }

    case "agent_files_listed": {
      if (!eventSessionId) return { state: baseState, effects };
      effects.push({ type: "agent-files/list", sessionId: eventSessionId });
      return { state: baseState, effects };
    }

    case "agent_file_written": {
      if (!eventSessionId) return { state: baseState, effects };
      effects.push({ type: "agent-files/list", sessionId: eventSessionId });
      const path = typeof data["path"] === "string" ? data["path"] : "";
      if (path) {
        effects.push({ type: "agent-files/read", sessionId: eventSessionId, path });
      }
      return { state: baseState, effects };
    }

    case "agent_file_deleted":
    case "agent_directory_created": {
      if (!eventSessionId) return { state: baseState, effects };
      effects.push({ type: "agent-files/list", sessionId: eventSessionId });
      return { state: baseState, effects };
    }

    case "agent_file_moved": {
      if (!eventSessionId) return { state: baseState, effects };
      effects.push({ type: "agent-files/list", sessionId: eventSessionId });
      const from = typeof data["from"] === "string" ? data["from"] : "";
      const to = typeof data["to"] === "string" ? data["to"] : "";
      if (from && to) {
        effects.push({ type: "agent-files/move", sessionId: eventSessionId, from, to });
      }
      return { state: baseState, effects };
    }

    case "run_end": {
      const resolvedRunId = typeof data["run_id"] === "string" ? data["run_id"] : state.activeRunId;
      effects.push({ type: "stream/set-active-run-id", runId: null });
      effects.push({ type: "stream/set-run-completed", value: true });
      effects.push({ type: "stream/set-loading", loading: false });
      effects.push({ type: "tools/clear-executing" });
      effects.push({ type: "stream/update-duration", runId: resolvedRunId ?? null });

      if (data["status"] && data["status"] !== "completed") {
        const errorMsg = typeof data["error"] === "string" ? data["error"] : "Run failed";
        effects.push({ type: "stream/set-error", error: errorMsg });
        effects.push({
          type: "toast/stream-error",
          message: errorMsg,
          activeRunId: null,
          lastEventTime: now,
        });
      }

      effects.push({
        type: "title/maybe-generate",
        sessionId: context.currentSessionId || eventSessionId || null,
        currentTitle: context.currentSessionTitle,
        lastUserInput: context.lastUserInput,
        lastAssistantContent: context.lastAssistantContent,
      });

      return {
        state: withState(baseState, {
          phase: "completed",
          activeRunId: null,
          runCompleted: true,
        }),
        effects,
      };
    }

    default:
      return { state: baseState, effects };
  }
}

