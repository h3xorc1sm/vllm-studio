# Execution Workpacks

This is a concrete sequence so you can execute without juggling everything mentally.

## Workpack A — Event contract hardening (P0.1)

**Scope**
- Controller event definitions
- Frontend event subscription + dispatch
- Shared types/constants

**Tasks**
1. Create `shared/events/*` with:
   - event name constants
   - payload interfaces
   - event domain grouping (chat/controller/recipe/runtime/distributed)
2. Replace string literals in controller emitters.
3. Replace frontend listener switch literals.
4. Add tests for event mapping and unknown event behavior.

**Validation**
- `cd controller && bun run typecheck && bun test`
- `cd frontend && npm run lint && npm run build`

**Output**
- Contract doc + code updates + passing tests.

## Workpack B — Settings/auth simplification (P0.2 + P0.3)

**Scope**
- frontend proxy settings + local overrides
- controller auth middleware and route allowlist

**Tasks**
1. Write `docs/plans/settings-auth-policy.md` (short policy doc).
2. Implement canonical settings resolution path.
3. Add auth middleware with explicit allowlist.
4. Add integration tests for:
   - backend URL precedence
   - auth-required endpoints
   - allowlisted public endpoints

**Validation**
- Controller + frontend checks pass.
- Manual smoke: valid/invalid API key against protected endpoint.

**Output**
- One policy doc + tested implementation.

## Workpack C — Complexity reduction (P1.1)

**Scope**
- `tool-call-core.ts`
- `run-manager.ts`
- `store.ts`

**Tasks**
1. Extract parser, stream state, transformation units from `tool-call-core.ts`.
2. Extract run lifecycle phases from `run-manager.ts`.
3. Extract chat store query modules by concern.
4. Keep route/manager public contracts unchanged.

**Validation**
- Snapshot tests for streaming behavior.
- Chat run integration tests against SSE + persistence.

**Output**
- Smaller modules + unchanged behavior.

## Workpack D — Versioned migrations (P1.2)

**Scope**
- SQLite schema management

**Tasks**
1. Add migration metadata table.
2. Create ordered migration files for existing schema.
3. Add migration runner with logs.
4. Add test fixtures: fresh DB + upgraded DB.

**Validation**
- Deterministic migration results in CI.

**Output**
- Reproducible schema evolution path.

## Workpack E — Topology truthfulness (P1.3)

**Scope**
- system status endpoint + docs/compose parity

**Tasks**
1. Make service checks conditional/configured.
2. Update docs to distinguish optional vs required services.
3. Add tests for service list generation.

**Validation**
- `/config` output aligns with deployed env.

**Output**
- Lower operational confusion and cleaner diagnostics.
