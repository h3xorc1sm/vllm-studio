# Threat Model for vLLM Studio

**Last Updated:** 2026-03-01
**Version:** 1.0.0
**Methodology:** STRIDE + Natural Language Analysis

---

## 1. System Overview

### Architecture Description

This is a local-first AI orchestration platform that lets users run and manage LLM/STT/TTS backends, chat with agent tooling, download models, inspect runtime health, and manage distributed node allocations. The system is built primarily with Bun + Hono (controller), Next.js (frontend), and SQLite/Postgres storage. The main components are:

1. **Controller API (`controller/src`)** - The control plane and proxy runtime exposing lifecycle, chat, model, audio, downloads, monitoring, jobs, and distributed APIs.
2. **Frontend API/UI (`frontend/src`)** - Browser-facing Next.js app and API routes that proxy/forward requests and store per-user API settings.
3. **External Runtime Services** - Inference backends (vLLM/sglang/llama.cpp/exllamav3), LiteLLM, Hugging Face, and Daytona sandbox/toolbox APIs.

### Key Components

| Component | Purpose | Security Criticality | Attack Surface |
| --- | --- | --- | --- |
| Controller (`controller/src/http/app.ts`) | Main API and orchestration engine | HIGH | HTTP routes under `/v1/*`, `/chats/*`, `/studio/*`, `/runtime/*`, `/distributed/*`, `/logs/*` |
| Frontend proxy routes (`frontend/src/app/api/proxy/[...path]/route.ts`) | Forwards browser traffic to backend | HIGH | Header/cookie URL override, auth forwarding, SSE proxy |
| Chat + Agent runtime (`controller/src/modules/chat`) | Stores chat state, executes agent runs/tools | HIGH | `/chats/:sessionId/*`, tool execution, file operations |
| Agent filesystem + Daytona (`controller/src/modules/chat/agent-files-routes.ts`, `services/daytona/toolbox-client.ts`) | Read/write/move/delete files in per-session workspace | HIGH | Path parameters, sandbox lifecycle endpoints |
| Lifecycle/process manager (`controller/src/modules/lifecycle`) | Spawns and kills model runtime processes | HIGH | Recipe create/update, launch/evict, runtime upgrade commands |
| Downloads (`controller/src/modules/downloads`) | Pulls model artifacts from Hugging Face | MEDIUM | User-supplied model IDs/patterns/path fragments, long-running network fetch |
| Monitoring/log streams (`controller/src/modules/monitoring`) | Streams logs/events/metrics/usage | MEDIUM | SSE streams, log session IDs, service status endpoints |
| Studio settings/model file ops (`controller/src/modules/studio/routes.ts`) | Persists config, moves/deletes model files | HIGH | Filesystem paths and mutating endpoints |
| Distributed control plane (`controller/src/modules/distributed`) | Registers nodes and layer allocations | MEDIUM | Node registration, heartbeats, allocation changes |
| CLI (`cli/src`) | Local terminal client to controller | LOW | Reads and invokes controller endpoints |

### Data Flow

A browser user interacts with the Next.js frontend, which either calls its own API routes (for settings/voice/proxy) or directly consumes controller SSE streams via proxy. The frontend proxy forwards requests to a selected backend URL and injects Authorization when available. The controller accepts API calls, may persist data into SQLite (`controller.db`, `chats.db`), may call local services (inference/LiteLLM), and may call remote services (Hugging Face and Daytona). For agent filesystem operations, user input crosses from HTTP route parameters into normalized paths and then into Daytona toolbox operations. For lifecycle flows, user recipe/runtime input can eventually influence process execution parameters and environment variables.

---

## 2. Trust Boundaries & Security Zones

### Trust Boundary Definition

The system has **3 trust zones**:

1. **Public Zone** - Untrusted user/browser/automation clients
   - Assumes: Malicious payloads, forged headers, abusive request rates
   - Entry Points: All controller HTTP routes and frontend API routes

2. **Authenticated Zone** - Intended authenticated use, but no mandatory server-side auth middleware is currently enforced
   - Assumes: Callers may present API keys but requests are not universally gated
   - Entry Points: Chat, downloads, lifecycle, studio, distributed, runtime mutation endpoints

3. **Internal Zone** - Controller internals and service-to-service calls
   - Assumes: Local process/service access is more trusted but still handles untrusted upstream content
   - Entry Points: SQLite stores, process manager, fetches to local inference/LiteLLM, Daytona/Hugging Face APIs

### Authentication & Authorization

Authentication is largely optional and route-specific. There is no global controller middleware enforcing API key/session authorization in `controller/src/http/app.ts`; CORS allows all origins (`origin: "*"`). The frontend proxy may forward Authorization headers or configured API keys, but this is not equivalent to controller-side authorization enforcement. Authorization checks for object ownership/role boundaries are generally absent for mutable resources (chat sessions, files, recipes, runtime upgrades, distributed state).

**Critical Security Controls:**

- Path normalization for agent files rejects `..` traversal (`normalizeAgentPath` in `controller/src/modules/chat/agent-files/helpers.ts`).
- Download path resolution constrains destination under `models_dir` (`resolveDownloadRoot` in `controller/src/modules/downloads/download-paths.ts`).
- Runtime route argument type checks for command args arrays (`controller/src/modules/lifecycle/routes/runtime-routes.ts`).

---

## 3. Attack Surface Inventory

### External Interfaces

#### Public HTTP Endpoints (Controller)

- `POST /v1/chat/completions`
  - **Input:** OpenAI-compatible JSON (model/messages/tools/stream)
  - **Validation:** Basic JSON parsing and some model normalization
  - **Risk:** Abuse for resource consumption, model/provider routing misuse, token/cost amplification

- `POST /chats/:sessionId/turn`
  - **Input:** User content, images, model/provider controls, agent flags
  - **Validation:** Basic type checks, content-or-image requirement
  - **Risk:** Prompt/tool abuse, event stream flooding, unauthorized access to other sessions

- `GET|PUT|DELETE /chats/:sessionId/files/*`, `POST /chats/:sessionId/files/dir|move`
  - **Input:** Wildcard file paths and file contents
  - **Validation:** Path normalization + invalid-path rejection
  - **Risk:** Unauthorized workspace modification/read, destructive file operations

- `POST /runtime/*/upgrade`
  - **Input:** Optional command + args from request body
  - **Validation:** args must be string array
  - **Risk:** Command execution misuse/privilege escalation by untrusted callers

- `POST /studio/models/delete`, `POST /studio/models/move`
  - **Input:** Filesystem paths
  - **Validation:** Source constrained to `models_dir`; move allows caller-chosen target root
  - **Risk:** Destructive operations; possible arbitrary write outside models root via target root

- `POST /distributed/nodes/register`, `POST /distributed/nodes/:nodeId/heartbeat`, allocation endpoints
  - **Input:** Node metadata/metrics/allocation bounds
  - **Validation:** shape checks and some regex/range checks
  - **Risk:** Cluster state poisoning, topology manipulation, spoofed node identity

- `GET /logs/:sessionId`, `DELETE /logs/:sessionId`, `GET /logs/:sessionId/stream`, `GET /events`
  - **Input:** Session IDs and stream subscriptions
  - **Validation:** `sanitizeLogSessionId`
  - **Risk:** Information disclosure, event fan-out DoS

#### Public HTTP Endpoints (Frontend API)

- `GET|POST|PUT|DELETE /api/proxy/[...path]`
  - **Input:** Path segments, query, optional backend override header/cookie
  - **Validation:** URL protocol validation for backend target, query api_key stripping
  - **Risk:** SSRF to attacker-controlled hosts, credential forwarding to untrusted backend, sensitive error/log leakage

- `GET|POST /api/settings`
  - **Input:** backendUrl/apiKey/voice settings
  - **Validation:** URL format check
  - **Risk:** Persistent secret exposure via insecure storage location fallback

- `POST /api/voice/transcribe`, `POST /api/voice/speak`
  - **Input:** multipart/json forwarded to voice targets
  - **Validation:** minimal payload checks + resolved target logic
  - **Risk:** upstream abuse, oversized payload processing, data exfil via external voice URL

#### File Upload Endpoints

- `POST /v1/audio/transcriptions`
  - **Input:** Multipart `file`, `model`, `mode`, `replace`, `language`
  - **Validation:** File presence, mode parsing, model path existence, optional ffmpeg transcode
  - **Risk:** DoS via large/malformed uploads, backend process starvation, path/model misuse

### Data Input Vectors

The system accepts user input from:

1. Browser JSON/form-data requests into controller and frontend API routes.
2. Path/query/header/cookie parameters (including backend URL overrides and auth headers).
3. Persisted config/settings and runtime recipe/job/distributed payloads.
4. External service responses (Hugging Face model metadata, Daytona toolbox/API responses).

---

## 4. Critical Assets & Data Classification

### Data Classification

#### PII (Potential)

- **Client IP/country/user agent** - Logged by frontend proxy and controller logging paths.
- **Chat message contents** - Stored in `chats.db`, may contain user secrets/prompts.

**Protection Measures:** Partial minimization only (UA truncation, path sanitization). No encryption-at-rest controls are visible in repo code.

#### Credentials & Secrets

- **Controller/Provider API keys** - `VLLM_STUDIO_API_KEY`, `OPENAI_API_KEY`, Daytona and HF tokens, LiteLLM master key.
- **Per-user frontend API key setting** - Persisted to JSON file (`api-settings.json`) in candidate directories.

**Protection Measures:** Keys are not intentionally returned in full by settings GET (masked). However, secrets can still transit logs/headers and are not centrally managed.

#### Business-Critical Data

- **Model artifacts and filesystem state** - Under `models_dir`, plus temporary audio/transcode files.
- **Operational control state** - Recipes, job records, distributed allocations, runtime status/logs/events.

---

## 5. Threat Analysis (STRIDE Framework)

### Understanding STRIDE for This System

Threats are mapped to concrete routes/components in this repository and prioritized by practical exploitability in local-network and remote-exposed deployments.

---

### S - Spoofing Identity

#### Threat: Unauthenticated control-plane spoofing

**Scenario:** An attacker on reachable network impersonates a legitimate operator and invokes lifecycle/studio/runtime/distributed mutation endpoints.

**Vulnerable Components:**

- `controller/src/http/app.ts` (no global auth middleware)
- Mutating route modules (`lifecycle-routes.ts`, `runtime-routes.ts`, `studio/routes.ts`, `distributed/routes.ts`, `downloads/routes.ts`)

**Attack Vector:**

1. Discover controller endpoint on port 8080.
2. Send unauthenticated `POST /runtime/vllm/upgrade` or `POST /launch/:recipeId`.
3. Trigger process/runtime changes without identity verification.
4. Gain operational control / service disruption.

**Code Pattern to Look For:**
```ts
// VULNERABLE: route exposed with no authentication/authorization middleware.
const app = new Hono();
app.use("*", cors({ origin: "*" }));
app.post("/runtime/vllm/upgrade", async (ctx) => { /* ... */ });

// SAFE: explicit auth guard before sensitive routes.
app.use("/runtime/*", requireApiKeyAuth);
app.post("/runtime/vllm/upgrade", upgradeHandler);
```

**Existing Mitigations:**

- Some config exposure endpoints only return boolean `api_key_configured`.

**Gaps:**

- No mandatory server-side authentication gate.
- No per-resource authorization model.

**Severity:** CRITICAL | **Likelihood:** HIGH

---

### T - Tampering with Data

#### Threat: Unauthorized filesystem tampering via studio model move target

**Scenario:** Caller provides `target_root` outside `models_dir` to move model directories into arbitrary writable locations.

**Vulnerable Components:**

- `controller/src/modules/studio/routes.ts` (`/studio/models/move`)

**Attack Vector:**

1. Call `POST /studio/models/move` with valid source inside models dir.
2. Set `target_root` to an arbitrary absolute path.
3. Server creates target root and moves/copies model files there.
4. Modify host filesystem layout and potentially poison other paths.

**Code Pattern to Look For:**
```ts
// VULNERABLE: validates source containment but trusts destination root.
const resolvedTargetRoot = resolve(targetRoot);
if (!existsSync(resolvedTargetRoot)) mkdirSync(resolvedTargetRoot, { recursive: true });
const target = resolve(resolvedTargetRoot, basename(resolvedSource));

// SAFE: enforce both source and destination under approved base.
const allowedRoot = resolve(context.config.models_dir);
if (!resolvedTargetRoot.startsWith(`${allowedRoot}${sep}`)) {
  throw badRequest("target_root must be inside models_dir");
}
```

**Existing Mitigations:**

- Source path is checked to remain under `models_dir`.

**Gaps:**

- Destination root not constrained to approved subtree.

**Severity:** HIGH | **Likelihood:** HIGH

#### Threat: Distributed allocation state tampering

**Scenario:** Any caller can alter model layer allocations and node heartbeats.

**Vulnerable Components:**

- `controller/src/modules/distributed/routes.ts`

**Attack Vector:**

1. Register spoofed node IDs.
2. Send forged heartbeats/metrics.
3. Overwrite allocations with malicious ranges.
4. Corrupt scheduling/topology and disrupt inference cluster.

**Severity:** HIGH | **Likelihood:** HIGH

---

### R - Repudiation

#### Threat: No verifiable actor identity in critical audit trails

**Scenario:** A user performs destructive operations and later denies it because logs capture network metadata but not authenticated identity.

**Vulnerable Components:**

- Controller route handlers across mutation endpoints
- `frontend/src/proxy.ts` access logs

**Attack Vector:**

1. Trigger mutating endpoint (delete/move/upgrade/evict).
2. System logs request metadata only.
3. No user identity/trace signature to tie action to principal.

**Code Pattern to Look For:**
```ts
// VULNERABLE: audit event lacks actor identity.
await eventManager.publish(new Event("MODEL_SWITCH", { status: "started", to_recipe_id: recipe.id }));

// SAFE: include authenticated principal + immutable request correlation id.
await eventManager.publish(new Event("MODEL_SWITCH", {
  actor_id: auth.subject,
  actor_type: "api_key",
  request_id,
  to_recipe_id: recipe.id
}));
```

**Existing Mitigations:**

- Event/log emission is broad and timestamped.

**Gaps:**

- No cryptographically reliable actor attribution.

**Severity:** MEDIUM | **Likelihood:** HIGH

---

### I - Information Disclosure

#### Threat: SSRF-style backend override leaks data/tokens to attacker host

**Scenario:** Frontend proxy accepts backend override header/cookie and forwards Authorization to that host.

**Vulnerable Components:**

- `frontend/src/app/api/proxy/[...path]/route.ts`

**Attack Vector:**

1. Set `x-backend-url: https://attacker.example` (or cookie override).
2. Send proxy request with Authorization or rely on configured API key fallback.
3. Proxy forwards request+token to attacker backend.
4. Exfiltrate credentials and request payloads.

**Code Pattern to Look For:**
```ts
// VULNERABLE: accepts arbitrary https/http override and forwards auth.
const overrideUrl = normalizeBackendUrl(request.headers.get("x-backend-url"));
if (incomingAuth) headers["Authorization"] = incomingAuth;
else if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;
await fetch(targetUrl, { headers });

// SAFE: allowlist approved backend origins before forwarding credentials.
if (!ALLOWED_BACKENDS.has(new URL(targetUrl).origin)) throw new Error("blocked backend override");
```

**Existing Mitigations:**

- Protocol validation (`http/https`) and fallback behavior.
- Query param `api_key` stripped from forwarded URL.

**Gaps:**

- No allowlist/private-address filtering for override hosts.
- Authorization forwarding to arbitrary override targets.

**Severity:** HIGH | **Likelihood:** HIGH

#### Threat: Sensitive error detail disclosure

**Scenario:** Proxy and API handlers return `details: String(error)` to clients.

**Vulnerable Components:**

- `frontend/src/app/api/proxy/[...path]/route.ts`
- `frontend/src/app/api/settings/route.ts`, voice routes, others

**Severity:** MEDIUM | **Likelihood:** HIGH

#### Threat: Log/event endpoints expose operational data without access control

**Scenario:** Anonymous caller retrieves logs, events, session metadata.

**Vulnerable Components:**

- `controller/src/modules/monitoring/logs-routes.ts`

**Severity:** HIGH | **Likelihood:** HIGH

---

### D - Denial of Service

#### Threat: Unbounded request/resource usage (no rate limiting)

**Scenario:** Attacker floods expensive endpoints (chat turns, audio transcription/speech, downloads, event streams).

**Vulnerable Components:**

- No global rate limiter in `controller/src/http/app.ts`
- High-cost endpoints in chat/audio/download/streaming routes

**Attack Vector:**

1. Open many SSE connections (`/events`, `/logs/:id/stream`).
2. Repeatedly post large/complex chat or audio payloads.
3. Exhaust CPU/GPU/network/file descriptors.
4. Degrade service for legitimate users.

**Existing Mitigations:**

- Some limits on list query (`limit` caps) and timeout wrappers in local fetch.

**Gaps:**

- Missing rate limits, request size limits, per-IP quotas.

**Severity:** HIGH | **Likelihood:** VERY HIGH

#### Threat: Runtime upgrade/launch abuse to force churn

**Scenario:** Repeated launch/evict/upgrade requests keep model backend unstable.

**Vulnerable Components:**

- `lifecycle-routes.ts`, `runtime-routes.ts`, process manager

**Severity:** HIGH | **Likelihood:** HIGH

---

### E - Elevation of Privilege

#### Threat: Command execution path exposed via runtime upgrades

**Scenario:** Caller supplies arbitrary command in runtime upgrade endpoints, executed by server process context.

**Vulnerable Components:**

- `controller/src/modules/lifecycle/routes/runtime-routes.ts`
- `controller/src/modules/lifecycle/runtime/runtime-upgrade.ts`
- `controller/src/core/command.ts` (`spawnSync` runner)

**Attack Vector:**

1. Send `POST /runtime/cuda/upgrade` with attacker-chosen command.
2. Server executes command via `runCommandUpgrade`.
3. Obtain code execution in controller privilege context.
4. Pivot to host modifications or persistence.

**Code Pattern to Look For:**
```ts
// VULNERABLE: untrusted command accepted from request body.
const command = typeof body?.command === "string" ? body.command : undefined;
const result = runPlatformUpgrade("cuda", { command, args });

// SAFE: ignore user-supplied command; only execute fixed allowlisted commands.
const result = runPlatformUpgrade("cuda", { command: undefined, args: undefined });
```

**Existing Mitigations:**

- `args` typed as string array.

**Gaps:**

- No auth/role gate + no command allowlist.

**Severity:** CRITICAL | **Likelihood:** HIGH

#### Threat: Agent command execution capability misuse (Daytona)

**Scenario:** Agent tool `execute_command` can run shell commands in workspace; if attacker controls prompts/session they can trigger privileged workflow actions inside sandbox.

**Vulnerable Components:**

- `controller/src/modules/chat/agent/tool-registry-daytona.ts`
- `services/daytona/toolbox-client.ts`

**Severity:** HIGH | **Likelihood:** MEDIUM

---

## 6. Vulnerability Pattern Library

### How to Use This Section

Use these patterns to quickly scan PRs and hot paths in this repository.

### SQL Injection Patterns (SQLite/Postgres)

```ts
// VULNERABLE: dynamic SQL interpolation from user input.
const rows = db.query(`SELECT * FROM chat_sessions WHERE id = '${sessionId}'`).all();

// SAFE: parameterized query (current repo commonly does this).
const row = db.query("SELECT * FROM chat_sessions WHERE id = ?").get(sessionId);
```

### XSS Patterns (Frontend)

```tsx
// VULNERABLE: rendering untrusted HTML directly.
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// SAFE: render as plain text or sanitize before HTML insertion.
<div>{userContent}</div>
```

### Command Injection / Arbitrary Command Execution

```ts
// VULNERABLE: command controlled by HTTP payload.
const command = body.command;
runCommand(command, body.args ?? []);

// SAFE: fixed command map + strict allowlist.
const allowed = { sglang: ["python3", ["-m", "pip", "install", "--upgrade", "sglang"]] };
const [cmd, args] = allowed[target];
runCommand(cmd, args);
```

### Path Traversal / Filesystem Escape

```ts
// VULNERABLE: resolve + write without boundary check.
const target = resolve(userPath);
writeFileSync(target, data);

// SAFE: normalize + enforce base path containment.
const base = resolve(modelsDir);
const target = resolve(base, ...sanitizePathSegments(userPath));
if (!target.startsWith(`${base}${sep}`)) throw new Error("Invalid path");
```

### Authentication Bypass Patterns

```ts
// VULNERABLE: sensitive route with no auth guard.
app.post("/runtime/vllm/upgrade", upgradeHandler);

// SAFE: explicit auth middleware on mutation routes.
app.use("/runtime/*", requireApiKeyAuth);
app.post("/runtime/vllm/upgrade", upgradeHandler);
```

### IDOR Patterns

```ts
// VULNERABLE: direct object/session access by id with no ownership check.
app.get("/chats/:sessionId", (ctx) => chatStore.getSession(ctx.req.param("sessionId")));

// SAFE: verify caller authorization for the resource.
const session = chatStore.getSession(sessionId);
if (!canAccessSession(auth.subject, session)) throw forbidden();
```

---

## 7. Security Testing Strategy

### Automated Testing

| Tool | Purpose | Frequency |
| --- | --- | --- |
| `eslint` + typecheck | Unsafe patterns + correctness baseline | Every commit |
| Unit tests (`bun test` / `vitest`) | Regressions in route behavior | Every commit |
| Custom security grep checks | Detect command/path/auth anti-patterns | Every commit |
| Dependency audit (`npm audit`/equivalent) | Known vulnerable packages | Daily/CI |
| Secret scanning | Token/key leakage in repo | Every commit |

### Manual Security Reviews

Required for:

- Any change under `runtime-routes.ts`, process launch/upgrade flows.
- New/changed proxy forwarding or backend override logic.
- Agent file/path/tool execution changes.
- Any route adding filesystem mutation or external fetch.

---

## 8. Assumptions & Accepted Risks

### Security Assumptions

1. **Deployment is often local/trusted network** - Risk increases sharply if exposed to untrusted networks.
2. **Daytona sandbox isolation limits host impact** - Workspace command/file actions are assumed isolated from host OS.
3. **Operators manage environment secrets securely** - .env and runtime secret handling are assumed controlled externally.

### Accepted Risks (Current)

1. **Broad CORS and missing global auth** - Accepted implicitly for local dev convenience; high priority to harden before internet exposure.
2. **Verbose operational telemetry in logs/events** - Accepted for observability, but should be access-controlled and redacted in hardened mode.

---

## 9. Threat Model Changelog

### Version 1.0.0 (2026-03-01)

- Initial threat model created for vLLM Studio repository.
- STRIDE analysis completed across controller + frontend proxy surfaces.
- Vulnerability pattern library tailored to Bun/Hono + Next.js + SQLite/process-control architecture.
