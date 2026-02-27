# Priority Roadmap (Maintainability First)

## Goal

Reduce cognitive load and regression risk in backend/frontend/database wiring while preserving existing behavior.

## P0 (Do first)

## P0.1 Event contract unification

**Problem:** Event names/payloads live in multiple places and drift.

**Deliverables**
- Create shared event contract module (names + payload types) under `shared/`.
- Make controller emitters and frontend listeners import contract constants/types.
- Add exhaustive handling + explicit default logging for unknown events.

**Success criteria**
- No string-literal event names outside contract modules.
- Build/typecheck passes controller + frontend.

## P0.2 Canonical connection settings flow

**Problem:** backend URL/API key persistence has overlapping sources.

**Deliverables**
- Define single canonical source of truth + one override layer.
- Document precedence in one file and enforce in code.
- Add tests for precedence and invalid override reset behavior.

**Success criteria**
- Deterministic backend selection with test coverage.
- No contradictory precedence paths.

## P0.3 Controller auth enforcement boundary

**Problem:** `VLLM_STUDIO_API_KEY` is present but enforcement is not centralized.

**Deliverables**
- Add explicit auth middleware in controller app wiring.
- Define allowlist for unauth endpoints (`/health`, docs, etc.) as policy.
- Add integration tests for allowed/blocked routes.

**Success criteria**
- Unauthorized access blocked by default.
- Auth behavior documented and tested.

## P1 (Stability and structure)

## P1.1 Split high-complexity modules

Prioritize decomposition of:
- `controller/src/modules/proxy/tool-call-core.ts`
- `controller/src/modules/chat/agent/run-manager.ts`
- `controller/src/modules/chat/store.ts`

**Deliverables**
- Extract parsing, persistence, and orchestration units.
- Keep public API shape stable.

**Success criteria**
- Reduced file size + lower function complexity.
- No behavior regressions in streaming and run persistence tests.

## P1.2 Versioned DB migrations

**Deliverables**
- Introduce schema version table and ordered migration files.
- Boot-time migration runner with rollback-safe checkpoints.

**Success criteria**
- Fresh boot and upgrade boot both deterministic.
- Migration status observable via a simple endpoint/log.

## P1.3 Infra status alignment

**Problem:** service status endpoint reports services not guaranteed by compose baseline.

**Deliverables**
- Make status checks environment-driven and accurate to deployed topology.
- Remove/flag stale checks.

**Success criteria**
- `/config` reflects real running topology.

## P2 (Developer velocity)

- Add architecture index docs for each module (`frontend`, `controller`, `shared`).
- Add contract-change checklist (events/config/routes/tests).
- Add CI guard: fail when event contracts drift.

## Tracking model

Use a weekly status table:

| Item | Owner | Status | Risk | ETA |
|---|---|---|---|---|
| P0.1 Event contract | | | | |
| P0.2 Config canonicalization | | | | |
| P0.3 Auth boundary | | | | |
| P1.1 Module split | | | | |
| P1.2 Migrations | | | | |
| P1.3 Infra alignment | | | | |
