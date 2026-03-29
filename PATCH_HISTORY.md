# vLLM Studio Patch History

## 0001 - Configurable electricity rate/currency on dashboard
**Date:** 2026-03-27
**Files:** frontend (dashboard), controller (config, system-routes)
**Status:** Applied
Description: Allows configuring electricity rate and currency from the UI instead of hardcoding USD/$0.11/kWh.

## 0005 - Fix energy period filtering
**Date:** 2026-03-27
**Files:** controller (metrics, usage)
**Status:** Applied
Description: Fixed energy consumption calculations not respecting period filters on usage page.

## 0006 - KV cache tracking via Prometheus metrics
**Date:** 2026-03-28/29
**Files:**
  - `controller/src/modules/lifecycle/metrics/metrics-collector.ts` — store prefix_cache_queries_total and prefix_cache_hits_total from vLLM Prometheus scrape
  - `controller/src/modules/monitoring/usage-routes.ts` — overlay Prometheus cache stats when per-request data is all zeros
  - `controller/src/modules/monitoring/usage/sqlite-request-logs.ts` — fix SQL WHERE clause bug + cache stats SQL query
  - `controller/src/modules/monitoring/metrics-store.ts` — cached_tokens column in request_logs schema + migration (already applied)
  - `controller/src/modules/proxy/openai-routes.ts` — extract cached_tokens from API response (already applied)
  - `controller/src/modules/proxy/tool-call-core.ts` — StreamUsage interface update (already applied)

**Status:** Partially applied (DB schema + request logging applied manually; Prometheus overlay pending deploy)

**Problem:** Usage page Cache Hit Rate card always showed 0%.

**Root cause:** vLLM does NOT expose `prompt_tokens_details.cached_tokens` in API responses (always null), even with `--enable-prefix-caching`. Prefix caching works internally (97.2% hit rate in logs) but the per-request data isn't surfaced.

**Solution:** Two-layer approach:
1. **Per-request tracking** (future-proof): `cached_tokens` column in `request_logs`, extraction from API response. Will work if vLLM adds this in future versions.
2. **Prometheus overlay** (current): Scrape `prefix_cache_queries_total` and `prefix_cache_hits_total` from vLLM's `/metrics` endpoint. Overlay these aggregate stats on the usage page when per-request data is all zeros.

**Also fixed:** SQL crash in `getUsageFromRequestLogs()` — two queries used `${where} AND` which produces invalid SQL (`AND` without `WHERE`) when no period filter is passed. Changed to `${where ? `${where} AND` : "WHERE"}`.
