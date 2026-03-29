// CRITICAL
import type { Database } from "bun:sqlite";
import { openSqliteDatabase } from "../../stores/sqlite";

export interface RequestLogEntry {
  id?: number;
  start_time: string;
  end_time?: string | null;
  model: string;
  status: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms?: number | null;
  ttft_ms?: number | null;
  session_id?: string | null;
  is_streaming: boolean;
  cached_tokens?: number | undefined;
}

const PERIOD_FILTERS: Record<string, string> = {
  d: "start_time >= datetime('now', '-24 hours')",
  w: "start_time >= datetime('now', '-7 days')",
  m: "start_time >= datetime('now', '-30 days')",
  y: "start_time >= datetime('now', '-365 days')",
};

/**
 * SQLite-backed storage for peak metrics per model.
 */
export class PeakMetricsStore {
  private readonly db: Database;

  /**
   * Create a peak metrics store.
   * @param dbPath - SQLite database path.
   */
  public constructor(dbPath: string) {
    this.db = openSqliteDatabase(dbPath);
    this.migrate();
  }

  /**
   * Initialize schema.
   * @returns void
   */
  private migrate(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS peak_metrics (
        model_id TEXT PRIMARY KEY,
        prefill_tps REAL,
        generation_tps REAL,
        ttft_ms REAL,
        total_tokens INTEGER DEFAULT 0,
        total_requests INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Get peak metrics for a model.
   * @param modelId - Model id.
   * @returns Metrics row or null.
   */
  public get(modelId: string): Record<string, unknown> | null {
    const row = this.db
      .query("SELECT * FROM peak_metrics WHERE model_id = ?")
      .get(modelId) as Record<string, unknown> | null;
    return row ? { ...row } : null;
  }

  /**
   * Update metrics if new values are better.
   * @param modelId - Model id.
   * @param prefillTps - Prefill tokens per second.
   * @param generationTps - Generation tokens per second.
   * @param ttftMs - Time-to-first-token in ms.
   * @returns Updated metrics.
   */
  public updateIfBetter(
    modelId: string,
    prefillTps?: number,
    generationTps?: number,
    ttftMs?: number
  ): Record<string, unknown> {
    const current = this.get(modelId);
    const updates: Record<string, number> = {};

    if (current) {
      if (
        prefillTps !== undefined &&
        (current["prefill_tps"] === null || Number(prefillTps) > Number(current["prefill_tps"]))
      ) {
        updates["prefill_tps"] = prefillTps;
      }
      if (
        generationTps !== undefined &&
        (current["generation_tps"] === null ||
          Number(generationTps) > Number(current["generation_tps"]))
      ) {
        updates["generation_tps"] = generationTps;
      }
      if (
        ttftMs !== undefined &&
        (current["ttft_ms"] === null || Number(ttftMs) < Number(current["ttft_ms"]))
      ) {
        updates["ttft_ms"] = ttftMs;
      }
    } else {
      if (prefillTps !== undefined) {
        updates["prefill_tps"] = prefillTps;
      }
      if (generationTps !== undefined) {
        updates["generation_tps"] = generationTps;
      }
      if (ttftMs !== undefined) {
        updates["ttft_ms"] = ttftMs;
      }
    }

    if (Object.keys(updates).length > 0) {
      if (current) {
        const setClause = Object.keys(updates)
          .map((key) => `${key} = ?`)
          .join(", ");
        this.db
          .query(
            `UPDATE peak_metrics SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE model_id = ?`
          )
          .run(...Object.values(updates), modelId);
      } else {
        this.db
          .query(
            `
          INSERT INTO peak_metrics (model_id, prefill_tps, generation_tps, ttft_ms)
          VALUES (?, ?, ?, ?)
        `
          )
          .run(
            modelId,
            updates["prefill_tps"] ?? null,
            updates["generation_tps"] ?? null,
            updates["ttft_ms"] ?? null
          );
      }
    }

    return this.get(modelId) ?? {};
  }

  /**
   * Add cumulative token and request counts.
   * @param modelId - Model id.
   * @param tokens - Tokens count.
   * @param requests - Request count.
   * @returns void
   */
  public addTokens(modelId: string, tokens: number, requests = 1): void {
    this.db
      .query(
        `
      INSERT INTO peak_metrics (model_id, total_tokens, total_requests)
      VALUES (?, ?, ?)
      ON CONFLICT(model_id) DO UPDATE SET
        total_tokens = total_tokens + excluded.total_tokens,
        total_requests = total_requests + excluded.total_requests,
        updated_at = CURRENT_TIMESTAMP
    `
      )
      .run(modelId, tokens, requests);
  }

  /**
   * Get all peak metrics.
   * @returns List of metrics rows.
   */
  public getAll(): Array<Record<string, unknown>> {
    const rows = this.db.query("SELECT * FROM peak_metrics ORDER BY model_id").all() as Array<
      Record<string, unknown>
    >;
    return rows.map((row) => ({ ...row }));
  }
}

/**
 * SQLite-backed storage for lifetime metrics.
 */
export class LifetimeMetricsStore {
  private readonly db: Database;

  /**
   * Create a lifetime metrics store.
   * @param dbPath - SQLite database path.
   */
  public constructor(dbPath: string) {
    this.db = openSqliteDatabase(dbPath);
    this.migrate();
  }

  /**
   * Initialize schema and defaults.
   * @returns void
   */
  private migrate(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS lifetime_metrics (
        key TEXT PRIMARY KEY,
        value REAL NOT NULL DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const defaults: Array<[string, number]> = [
      ["tokens_total", 0],
      ["prompt_tokens_total", 0],
      ["completion_tokens_total", 0],
      ["energy_wh", 0],
      ["uptime_seconds", 0],
      ["requests_total", 0],
      ["first_started_at", 0],
    ];
    for (const [key, value] of defaults) {
      this.db
        .query("INSERT OR IGNORE INTO lifetime_metrics (key, value) VALUES (?, ?)")
        .run(key, value);
    }

    this.db.run(`
      CREATE TABLE IF NOT EXISTS request_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        model TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        latency_ms REAL,
        ttft_ms REAL,
        session_id TEXT,
        is_streaming INTEGER NOT NULL DEFAULT 0,
        cached_tokens INTEGER DEFAULT 0
      )
    `);
    this.db.run(
      "CREATE INDEX IF NOT EXISTS idx_request_logs_start_time ON request_logs(start_time)"
    );
    this.db.run("CREATE INDEX IF NOT EXISTS idx_request_logs_model ON request_logs(model)");

    // Migration: add cached_tokens column to existing databases
    const columns = this.db.query("PRAGMA table_info(request_logs)").all() as Array<{ name: string }>;
    if (!columns.some((col) => col.name === "cached_tokens")) {
      this.db.run("ALTER TABLE request_logs ADD COLUMN cached_tokens INTEGER DEFAULT 0");
    }

    this.db.run(`
      CREATE TABLE IF NOT EXISTS energy_snapshots (
        sampled_at TEXT PRIMARY KEY,
        energy_wh REAL NOT NULL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS usage_hourly (
        hour TEXT PRIMARY KEY,
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        cache_queries INTEGER NOT NULL DEFAULT 0,
        cache_hits INTEGER NOT NULL DEFAULT 0,
        energy_wh REAL NOT NULL DEFAULT 0
      )
    `);
  }

  /**
   * Get a lifetime metric value.
   * @param key - Metric key.
   * @returns Metric value.
   */
  public get(key: string): number {
    const row = this.db.query("SELECT value FROM lifetime_metrics WHERE key = ?").get(key) as {
      value?: number;
    } | null;
    return row?.value ?? 0;
  }

  /**
   * Get all lifetime metrics.
   * @returns Map of metric values.
   */
  public getAll(): Record<string, number> {
    const rows = this.db.query("SELECT key, value FROM lifetime_metrics").all() as Array<{
      key: string;
      value: number;
    }>;
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  /**
   * Set a lifetime metric.
   * @param key - Metric key.
   * @param value - Metric value.
   * @returns void
   */
  public set(key: string, value: number): void {
    this.db
      .query(
        `INSERT INTO lifetime_metrics (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
      )
      .run(key, value);
  }

  /**
   * Increment a lifetime metric.
   * @param key - Metric key.
   * @param delta - Increment value.
   * @returns Updated value.
   */
  public increment(key: string, delta: number): number {
    this.db
      .query(
        `INSERT INTO lifetime_metrics (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = value + excluded.value, updated_at = CURRENT_TIMESTAMP`
      )
      .run(key, delta);
    return this.get(key);
  }

  /**
   * Ensure first_started_at is set.
   * @returns void
   */
  public ensureFirstStarted(): void {
    const current = this.get("first_started_at");
    if (current === 0) {
      this.set("first_started_at", Date.now() / 1000);
    }
  }

  /**
   * Add energy consumption in watt-hours.
   * @param wattHours - Watt hours to add.
   * @returns void
   */
  public addEnergy(wattHours: number): void {
    this.increment("energy_wh", wattHours);
  }

  /**
   * Add total tokens.
   * @param tokens - Tokens to add.
   * @returns void
   */
  public addTokens(tokens: number): void {
    this.increment("tokens_total", tokens);
  }

  /**
   * Add prompt tokens.
   * @param tokens - Tokens to add.
   * @returns void
   */
  public addPromptTokens(tokens: number): void {
    this.increment("prompt_tokens_total", tokens);
  }

  /**
   * Add completion tokens.
   * @param tokens - Tokens to add.
   * @returns void
   */
  public addCompletionTokens(tokens: number): void {
    this.increment("completion_tokens_total", tokens);
  }

  /**
   * Add uptime in seconds.
   * @param seconds - Seconds to add.
   * @returns void
   */
  public addUptime(seconds: number): void {
    this.increment("uptime_seconds", seconds);
  }

  /**
   * Add request count.
   * @param count - Requests to add.
   * @returns void
   */
  public addRequests(count = 1): void {
    this.increment("requests_total", count);
  }

  public insertRequestLog(entry: RequestLogEntry): number {
    const result = this.db
      .query(
        `INSERT INTO request_logs (start_time, end_time, model, status, prompt_tokens, completion_tokens, total_tokens, latency_ms, ttft_ms, session_id, is_streaming, cached_tokens)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry.start_time,
        entry.end_time ?? null,
        entry.model,
        entry.status,
        entry.prompt_tokens,
        entry.completion_tokens,
        entry.total_tokens,
        entry.latency_ms ?? null,
        entry.ttft_ms ?? null,
        entry.session_id ?? null,
        entry.is_streaming ? 1 : 0,
        entry.cached_tokens ?? 0,
      );
    return Number(result.lastInsertRowid);
  }

  public updateRequestLog(id: number, updates: Partial<RequestLogEntry>): void {
    const fields: string[] = [];
    const values: Array<string | number | null> = [];
    for (const [key, value] of Object.entries(updates)) {
      if (key === "id") continue;
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(key === "is_streaming" ? (value ? 1 : 0) : (value as string | number | null));
      }
    }
    if (fields.length === 0) return;
    values.push(id);
    this.db.query(`UPDATE request_logs SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  public getRequestLogs(period?: string): { rows: Array<RequestLogEntry & { id: number }>; filtered: boolean } {
    const where = period && PERIOD_FILTERS[period] ? `WHERE ${PERIOD_FILTERS[period]}` : "";
    const rows = this.db
      .query(`SELECT * FROM request_logs ${where} ORDER BY start_time DESC`)
      .all() as Array<Record<string, unknown>>;
    return {
      rows: rows.map((r) => ({
        id: Number(r["id"]),
        start_time: String(r["start_time"] ?? ""),
        end_time: r["end_time"] ? String(r["end_time"]) : null,
        model: String(r["model"] ?? "unknown"),
        status: String(r["status"] ?? "pending"),
        prompt_tokens: Number(r["prompt_tokens"] ?? 0),
        completion_tokens: Number(r["completion_tokens"] ?? 0),
        total_tokens: Number(r["total_tokens"] ?? 0),
        latency_ms: r["latency_ms"] != null ? Number(r["latency_ms"]) : null,
        ttft_ms: r["ttft_ms"] != null ? Number(r["ttft_ms"]) : null,
        session_id: r["session_id"] ? String(r["session_id"]) : null,
        is_streaming: Boolean(r["is_streaming"]),
        cached_tokens: Number(r["cached_tokens"] ?? 0),
      })),
      filtered: Boolean(period && PERIOD_FILTERS[period]),
    };
  }

  public getRequestLogCount(period?: string): number {
    const where = period && PERIOD_FILTERS[period] ? `WHERE ${PERIOD_FILTERS[period]}` : "";
    const row = this.db.query(`SELECT COUNT(*) as cnt FROM request_logs ${where}`).get() as {
      cnt: number;
    };
    return row?.cnt ?? 0;
  }

  public recordEnergySnapshot(energyWh: number): void {
    this.db
      .query(
        "INSERT OR REPLACE INTO energy_snapshots (sampled_at, energy_wh) VALUES (datetime('now'), ?)"
      )
      .run(energyWh);
  }

  public getEnergyBefore(timestamp: string): { energy_wh: number } | null {
    const row = this.db
      .query("SELECT energy_wh FROM energy_snapshots WHERE sampled_at <= ? ORDER BY sampled_at DESC LIMIT 1")
      .get(timestamp) as { energy_wh: number } | null;
    return row;
  }

  public getCurrentEnergy(): number {
    return this.get("energy_wh");
  }

  public recordUsageHour(deltas: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cache_queries?: number;
    cache_hits?: number;
    energy_wh?: number;
  }): void {
    const hour = new Date().toISOString().slice(0, 13);
    this.db
      .query(
        `INSERT INTO usage_hourly (hour, prompt_tokens, completion_tokens, cache_queries, cache_hits, energy_wh)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(hour) DO UPDATE SET
           prompt_tokens = prompt_tokens + excluded.prompt_tokens,
           completion_tokens = completion_tokens + excluded.completion_tokens,
           cache_queries = cache_queries + excluded.cache_queries,
           cache_hits = cache_hits + excluded.cache_hits,
           energy_wh = energy_wh + excluded.energy_wh`
      )
      .run(
        hour,
        deltas.prompt_tokens ?? 0,
        deltas.completion_tokens ?? 0,
        deltas.cache_queries ?? 0,
        deltas.cache_hits ?? 0,
        deltas.energy_wh ?? 0
      );
  }

  private static readonly HOURLY_PERIOD_SQL: Record<string, string> = {
    d: "hour >= strftime('%Y-%m-%dT%H', 'now', '-24 hours')",
    w: "hour >= strftime('%Y-%m-%dT%H', 'now', '-7 days')",
    m: "hour >= strftime('%Y-%m-%dT%H', 'now', '-30 days')",
    y: "hour >= strftime('%Y-%m-%dT%H', 'now', '-365 days')",
  };

  public getUsageHourly(period?: string): {
    prompt_tokens: number;
    completion_tokens: number;
    cache_queries: number;
    cache_hits: number;
    energy_wh: number;
  } | null {
    const where = period && LifetimeMetricsStore.HOURLY_PERIOD_SQL[period]
      ? `WHERE ${LifetimeMetricsStore.HOURLY_PERIOD_SQL[period]}`
      : "";
    const row = this.db.query(`
      SELECT
        COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
        COALESCE(SUM(completion_tokens), 0) as completion_tokens,
        COALESCE(SUM(cache_queries), 0) as cache_queries,
        COALESCE(SUM(cache_hits), 0) as cache_hits,
        COALESCE(SUM(energy_wh), 0) as energy_wh
      FROM usage_hourly ${where}
    `).get() as {
      prompt_tokens: number;
      completion_tokens: number;
      cache_queries: number;
      cache_hits: number;
      energy_wh: number;
    } | null;
    if (!row || (row.prompt_tokens === 0 && row.completion_tokens === 0 && row.cache_queries === 0 && row.energy_wh === 0)) {
      return null;
    }
    return row;
  }
}

export { PERIOD_FILTERS };
