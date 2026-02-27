# 7-Day Execution Schedule (Backend ↔ Frontend ↔ DB)

Start date baseline: **Friday, February 27, 2026**.

## Rules of engagement

- Every day ends with one merged PR-sized change set (or one branch commit if batching).
- Every day includes validation evidence in `test-output/plans/day-0X.md`.
- No silent drift: event/config/schema changes require matching tests + doc delta in same day.

## Day 1 — Event contract hardening (Workpack A)

**Target**
- Establish one canonical controller event contract used by frontend + controller.
- Add explicit unknown-event behavior.

**Deliverables**
- `shared/src/controller-events.ts` with event constants + domain routing helpers.
- Controller emitters migrated to event constants (no raw event string literals in emit paths).
- Frontend SSE routing uses contract helpers, with unknown-event logging.
- Frontend tests for mapping + unknown handling.

**Validation**
- `cd controller && bun run typecheck && bun test`
- `cd frontend && npm run lint && npm run test && npm run build`

## Day 2 — Canonical settings precedence (Workpack B, part 1)

**Target**
- Remove backend URL/API key precedence ambiguity.

**Deliverables**
- `docs/plans/settings-auth-policy.md` describing exact precedence order.
- Single resolution function used by API proxy, SSE setup, and settings UI.
- Tests for precedence and invalid override reset.

**Validation**
- Frontend lint/test/build
- Targeted proxy/settings API tests

## Day 3 — Controller auth boundary (Workpack B, part 2)

**Target**
- Default-deny auth gate in controller with explicit allowlist.

**Deliverables**
- Central auth middleware + route allowlist constants.
- Integration tests for allowed/blocked routes with and without `VLLM_STUDIO_API_KEY`.
- Auth policy section appended to `docs/plans/settings-auth-policy.md`.

**Validation**
- `cd controller && bun run typecheck && bun test`

## Day 4 — Complexity split: `tool-call-core.ts` (Workpack C, part 1)

**Target**
- Reduce streaming/parser complexity without behavior change.

**Deliverables**
- Extract parsing and stream-state units into focused modules.
- Preserve public API of existing proxy pathway.
- Snapshot-style tests for split/multiline SSE tool-call/thinking parsing.

**Validation**
- Controller typecheck + full tests

## Day 5 — Complexity split: `run-manager.ts` + `store.ts` seams (Workpack C, part 2)

**Target**
- Pull orchestration and persistence concerns apart for chat runs.

**Deliverables**
- Run lifecycle phase helpers extracted from run manager.
- Store query helpers grouped by concern in `store` submodules.
- No route API changes; behavior parity tests retained/expanded.

**Validation**
- Controller typecheck + full tests
- Frontend build smoke for chat pages

## Day 6 — Versioned migrations (Workpack D)

**Target**
- Replace implicit schema drift with explicit ordered migrations.

**Deliverables**
- Migration metadata table + runner.
- Baseline migration files for current schema.
- Fixtures/tests: fresh DB bootstrap + upgrade path.

**Validation**
- Deterministic migration tests in CI-like local run

## Day 7 — Topology truthfulness + closeout (Workpack E)

**Target**
- Make status/config output match real deployment topology.

**Deliverables**
- Service checks made environment-driven.
- `/config` and status docs updated for required vs optional services.
- Final architecture index update + risk register refresh.
- `docs/plans/05-closeout-report.md` with before/after diffs and follow-up backlog.

**Validation**
- Controller + frontend full validation pass
- Manual smoke against local compose profile

## Daily reporting template

Each day append:

```md
## Day N report
- Completed:
- Evidence:
- Tests run:
- Regressions found:
- Next-day risks:
```
