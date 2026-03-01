# Chat run manager decoupling plan (strict refactor)

Goal: simplify/decouple `controller/src/modules/chat/agent/run-manager.ts` without changing behavior. Use Factory-ish patterns: clear interfaces, small modules, wiring at the edge, dependency injection.

## Why this area is complex today
`ChatRunManager.startRun()` currently handles:
- input validation + user message persistence (including image parts)
- model/provider/api key resolution + system prompt + thinking level
- run persistence (create/update run rows, run events)
- Agent construction + tool registry wiring
- per-run mutable state (assistant message ids, tool execution maps, turn index, UTF-8 cleanup state)
- agent event handling (SSE publishing + persistence side effects)
- stream lifecycle (keepalive, abort, finalization)

This makes the code hard to reason about, hard to test in isolation, and easy to break with “small” changes.

## Target architecture
### Principle: wiring at the edge
Keep `ChatRunManager` as a thin boundary object. Move orchestration into a dedicated run factory + small services.

### Proposed top-level interfaces
```ts
export interface ChatRunFactory {
  createRun(options: ChatRunOptions): Promise<{
    runId: string;
    stream: AsyncIterable<string>;
    abort: () => void;
  }>;
}
```

Adapt `AppContext` once into a smaller dependency bag:
```ts
type RunDeps = {
  chatStore: AppContext["stores"]["chatStore"];
  processManager: AppContext["processManager"];
  config: AppContext["config"];
  eventManager: AppContext["eventManager"];
};
```

## Extracted modules (behavior-preserving)
1) **ModelSelectionService**
- owns model/provider selection + normalization + API key resolution
- outputs a single `ProviderContext`:
```ts
type ProviderContext = {
  provider: string;
  requestModel: string;
  storedModel: string;
  apiKey: string;
  baseUrl: string; // http://localhost:${port}/v1
};
```

2) **UserMessageWriter**
- encapsulates `chatStore.addMessage(...)` for user messages
- owns user message parts building (text + optional images)

3) **RunRecordWriter**
- encapsulates `chatStore.createRun(...)` and `chatStore.updateRun(...)`

4) **AgentRuntimeFactory**
- builds and configures `Agent` (model, streamFn, retry settings, message conversion)
- does not perform persistence or SSE

5) **AgentEventPipeline**
- owns per-run mutable state:
  - `toolExecutionStarts`, `toolCallToMessageId`
  - `currentAssistantMessageId`, `lastAssistantMessageId`
  - `turnIndex`
  - UTF-8 cleanup state
  - runStatus/runError
- wraps existing `handleAgentEvent(...)` so behavior stays identical

6) **RunStreamPublisher**
- wraps `createRunPublisher` + `createSseStream`
- hides queue capacity and stream lifecycle plumbing

## Wiring module
Create a single “edge wiring” module (e.g. `chat-run-factory.ts` or `run-wiring.ts`) that composes:
- publisher
- agent
- tools
- event pipeline
- prompt execution + finalization

This becomes the only file that “knows everything”.

## Staged implementation plan
### Stage 1: Mechanical extraction (no behavior change)
- Add new files:
  - `run-deps.ts`
  - `model-selection-service.ts`
  - `user-message-writer.ts`
  - `run-record-writer.ts`
  - `agent-runtime-factory.ts`
  - `agent-event-pipeline.ts`
  - `chat-run-factory.ts`
- Modify `ChatRunManager.startRun()` to delegate to `ChatRunFactory`.
- Keep existing helpers intact:
  - `handleAgentEvent` remains
  - `persistAssistantMessage` remains
  - `createRunPublisher/createSseStream` remain

### Stage 2: Localize incidental complexity
- move `cleanUtf8StreamContent` logic into `AgentEventPipeline`
- move `mapToolCallsToMessage` and `parseToolServer` into a small helper owned by pipeline

### Stage 3: Performance-safe tweaks
- ensure stable closures and minimize per-event allocations
- keep queue capacity constant but centralize the constant for visibility

## Verification strategy
Primary controller tests:
- `controller/src/tests/tool-call-core.test.ts`
- `controller/src/modules/chat/store.test.ts`
- `controller/src/modules/chat/agent/tool-registry.test.ts`
- `controller/src/tests/runtime-summary-events.test.ts`

Commands (once implemented):
- `cd controller && bun test`
- plus repo lint/typecheck scripts as configured
