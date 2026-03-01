# Stage-1: ChatRunManager Strict Refactor — File-by-File Plan

## Goal

Extract responsibilities from the 450-line `ChatRunManager` class into a **ChatRunFactory** (run setup/wiring) and small focused services, **without any behavior or event-ordering changes**. The public API surface (`ChatRunManager.startRun`, `ChatRunManager.abortRun`, `ChatRunOptions`, `ChatRunStream`) stays identical.

---

## Current Structure Summary

| Responsibility | Lines (approx.) | Notes |
|---|---|---|
| Model resolution | `resolveModel` (50 lines), `resolveApiKey` (10 lines) | Async; touches processManager, config, env |
| User message persistence | inline in `startRun` (~15 lines) | `chatStore.addMessage` for user msg |
| Agent wiring (Agent construction, subscribe, tools) | ~60 lines | Creates `Agent`, `AbortController`, maps, utf8State |
| Run lifecycle state (maps, status, turnIndex, utf8) | ~30 lines | Mutable locals captured in closures |
| Mock inference path | `startMockRun` (~80 lines) | Duplicates user-persist + run-create + SSE plumbing |
| Utility helpers | `mapToolCallsToMessage`, `parseToolServer`, `isMockInferenceEnabled` | Pure/stateless |

Already extracted into separate files:
- `run-manager-persistence.ts` — `persistAssistantMessage`, `extractToolResultText`
- `run-manager-sse.ts` — `createRunPublisher`, `createSseStream`, `encodeSseEvent`
- `agent-event-handler.ts` — `handleAgentEvent` + types
- `model-factory.ts` — `createOpenAiCompatibleModel`
- `system-prompt-builder.ts` — `buildSystemPrompt`
- `message-mapper.ts` — `mapStoredMessagesToAgentMessages`, `mapAgentMessagesToLlm`
- `tool-registry.ts` — `buildAgentTools`
- `stream-openai-completions-safe.ts` — `streamOpenAiCompletionsSafe`
- `contracts.ts` — event type constants

---

## New / Modified Files

### 1. **NEW** `controller/src/modules/chat/agent/run-manager-model-resolver.ts`

**Purpose**: Extract `resolveModel` and `resolveApiKey` into a stateless service.

```ts
// Exported types
export type ResolvedModelSelection = {
  requestModel: string;
  storedModel: string;
  provider: string;
};

// Exported functions
export async function resolveModel(
  context: AppContext,
  session: Record<string, unknown>,
  override?: string,
  overrideProvider?: string,
): Promise<ResolvedModelSelection>;

export function resolveApiKey(
  context: AppContext,
  provider?: string,
): string;
```

**Migrated from**: `ChatRunManager.resolveModel` (private, ~50 lines) and `ChatRunManager.resolveApiKey` (private, ~10 lines). Move verbatim; change `this.context` → parameter `context`.

**Tricky state**: `resolveModel` is async and calls `context.processManager.findInferenceProcess()`. No mutation, pure query — safe to extract.

---

### 2. **NEW** `controller/src/modules/chat/agent/run-manager-utils.ts`

**Purpose**: Small pure helpers currently living as private methods.

```ts
// Exported functions
export function isMockInferenceEnabled(): boolean;

export function parseToolServer(toolName: string): string | null;

export function mapToolCallsToMessage(
  assistant: AssistantMessage,
  messageId: string | null,
  toolCallToMessageId: Map<string, string>,
): void;
```

**Migrated from**: Three private methods on `ChatRunManager`. All are stateless / pure — move verbatim, drop `this`.

---

### 3. **NEW** `controller/src/modules/chat/agent/run-manager-utf8.ts`

**Purpose**: Isolate the UTF-8 stream cleaning closure builder.

```ts
import type { Utf8State } from "../../proxy/types";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

// Exported types
export type MessageCleaner = (message: AgentMessage) => void;

// Exported functions
export function createMessageCleaner(): MessageCleaner;
```

**Migrated from**: The `utf8State` + `cleanMessage` closure block (~30 lines in `startRun`). Returns a `cleanMessage` function that captures its own `Utf8State` internally — no state leaks.

**Tricky state**: `utf8State` is mutable and captured by reference in the `cleanMessage` closure. The factory function encapsulates this: each call to `createMessageCleaner()` produces a fresh `Utf8State`. This preserves current per-run isolation.

---

### 4. **NEW** `controller/src/modules/chat/agent/chat-run-factory.ts`

**Purpose**: Orchestrate run setup — the "wiring" that currently lives in `startRun`. This is a **function**, not a class, to keep it simple.

```ts
import type { AppContext } from "../../../types/context";
import type { ChatRunOptions, ChatRunStream } from "./run-manager-types";

// Exported function
export async function createChatRun(
  context: AppContext,
  activeRuns: Map<string, { agent: Agent; abort: AbortController }>,
  options: ChatRunOptions,
): Promise<ChatRunStream>;
```

**What it does** (same as current `startRun` body):
1. Validate session + content.
2. Call `resolveModel` / `resolveApiKey` (from `run-manager-model-resolver`).
3. Build system prompt, tools, model, history.
4. Persist user message.
5. Create run record.
6. Create `Agent`, `AsyncQueue`, `AbortController`.
7. Register in `activeRuns`.
8. Wire event subscription via `handleAgentEvent`.
9. Call `createMessageCleaner()` for UTF-8 state.
10. Publish `RUN_START`, kick off `agent.prompt()`.
11. Return `{ runId, stream }`.

Event ordering is preserved because we move the **exact same sequential code** into this function.

**Why `activeRuns` is a parameter**: The `Map<string, ...>` is owned by `ChatRunManager` and shared between `startRun` and `abortRun`. Passing it in keeps the refactor mechanical — no new singleton or service for active-run tracking.

---

### 5. **NEW** `controller/src/modules/chat/agent/chat-run-factory-mock.ts`

**Purpose**: Extract `startMockRun` into a standalone factory function.

```ts
export async function createMockChatRun(
  context: AppContext,
  session: Record<string, unknown>,
  options: ChatRunOptions,
  content: string,
): Promise<ChatRunStream>;
```

**Migrated from**: `ChatRunManager.startMockRun` (~80 lines). Move verbatim; replace `this.context` → `context`, `this.resolveModel` → imported `resolveModel`.

---

### 6. **NEW** `controller/src/modules/chat/agent/run-manager-types.ts`

**Purpose**: Shared type definitions currently in `run-manager.ts`.

```ts
// Moved verbatim from run-manager.ts
export interface ChatRunOptions { ... }
export interface ChatRunStream { ... }
```

These are re-exported from `run-manager.ts` to keep the external import path stable.

---

### 7. **MODIFIED** `controller/src/modules/chat/agent/run-manager.ts`

**After refactor** (~40 lines):

```ts
import type { Agent } from "@mariozechner/pi-agent-core";
import type { AppContext } from "../../../types/context";
import { createChatRun } from "./chat-run-factory";
import { createMockChatRun } from "./chat-run-factory-mock";
import { isMockInferenceEnabled } from "./run-manager-utils";

// Re-export types so external consumers don't break
export type { ChatRunOptions, ChatRunStream } from "./run-manager-types";

export class ChatRunManager {
  private readonly context: AppContext;
  private readonly activeRuns = new Map<string, { agent: Agent; abort: AbortController }>();

  public constructor(context: AppContext) {
    this.context = context;
  }

  public abortRun(runId: string): boolean {
    const active = this.activeRuns.get(runId);
    if (!active) return false;
    active.agent.abort();
    active.abort.abort();
    return true;
  }

  public async startRun(options: ChatRunOptions): Promise<ChatRunStream> {
    const session = this.context.stores.chatStore.getSession(options.sessionId);
    if (!session) throw new Error("Session not found");

    const content = options.content.trim();
    const hasImageInput = Array.isArray(options.images) && options.images.length > 0;
    if (!content && !hasImageInput) throw new Error("Message content is required");

    if (isMockInferenceEnabled()) {
      return createMockChatRun(this.context, session, options, content);
    }

    return createChatRun(this.context, this.activeRuns, options);
  }
}
```

**Lines reduced**: ~450 → ~40 (91% reduction).

---

### 8. **MODIFIED** `controller/src/modules/chat/agent/index.ts`

Add re-exports for new modules:

```ts
// Append:
export * from "./run-manager-types";
export * from "./run-manager-model-resolver";
export * from "./run-manager-utils";
export * from "./run-manager-utf8";
export * from "./chat-run-factory";
export * from "./chat-run-factory-mock";
```

---

## External API Preservation Checklist

| Consumer | Import | Status |
|---|---|---|
| `app-context.ts` | `import { ChatRunManager } from "./modules/chat/agent/run-manager"` | ✅ No change — class still exported from same path |
| `types/context.ts` | `import type { ChatRunManager } from "../modules/chat/agent/run-manager"` | ✅ No change |
| `chats-routes.ts` | `context.runManager.startRun(...)`, `.abortRun(...)` | ✅ No change — same methods, same signatures |
| Barrel `index.ts` | `export * from "./run-manager"` | ✅ Types re-exported via `run-manager.ts` → `run-manager-types.ts` |

---

## Event Ordering Guarantee

The current event sequence is:
```
RUN_START → [TURN_START → MESSAGE_START → MESSAGE_UPDATE* → MESSAGE_END → 
  (TOOL_EXECUTION_START → TOOL_EXECUTION_UPDATE* → TOOL_EXECUTION_END)* → 
  TURN_END]* → RUN_END
```

This ordering is preserved because:
1. `createChatRun` calls the same code in the same sequence.
2. The `agent.subscribe` → `handleAgentEvent` → `publish` pipeline is unchanged.
3. `RUN_START` is emitted **before** `agent.prompt()` — same as today.
4. `RUN_END` is emitted in the `.finally()` block — same as today.

---

## Tricky State Notes

### `activeRuns` Map
- Owned by `ChatRunManager`, passed by reference to `createChatRun`.
- `abortRun` reads it; `createChatRun` writes and deletes from it.
- Thread-safe in Node.js single-event-loop model (no change).

### `utf8State` (per-run mutable state)
- Currently a closure-captured local in `startRun`.
- Moved into `createMessageCleaner()` which returns a closure with its own fresh `Utf8State`.
- Each run gets its own state — same isolation as today.

### Per-run mutable locals (`currentAssistantMessageId`, `lastAssistantMessageId`, `turnIndex`, `runStatus`, `runError`, `toolExecutionStarts`, `toolCallToMessageId`)
- These stay as locals inside `createChatRun`, captured by the event-handler closure.
- No change in lifetime or mutation pattern.

### Mock run path
- `startMockRun` duplicates some setup (user message persist, run create, SSE publisher).
- In Stage-1 we extract it as-is into `createMockChatRun`. A Stage-2 could DRY the shared setup, but that's out of scope.

---

## Test Preservation

- **No existing unit tests** directly test `ChatRunManager` (verified by grep for `run-manager|ChatRunManager` in `*.test.ts`).
- Existing tests (`store.test.ts`, `tool-registry.test.ts`, `daytona-agentfs.test.ts`) don't import from `run-manager.ts`.
- The refactor does not modify `agent-event-handler.ts`, `run-manager-persistence.ts`, or `run-manager-sse.ts` — their test surface is unaffected.
- After refactor, the extracted pure functions (`resolveModel`, `resolveApiKey`, `isMockInferenceEnabled`, `parseToolServer`, `mapToolCallsToMessage`, `createMessageCleaner`) become individually testable.

---

## Migration Order (Recommended)

1. Create `run-manager-types.ts` (types only, zero risk).
2. Create `run-manager-utils.ts` (pure functions, easy to verify).
3. Create `run-manager-utf8.ts` (closure factory, easy to verify).
4. Create `run-manager-model-resolver.ts` (async but stateless).
5. Create `chat-run-factory-mock.ts` (self-contained mock path).
6. Create `chat-run-factory.ts` (main wiring — largest piece).
7. Slim down `run-manager.ts` to delegate to factories.
8. Update `index.ts` barrel.
9. Run full build + existing tests to verify no regressions.

Each step can be committed and verified independently.
