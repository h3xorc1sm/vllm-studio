// CRITICAL
import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import type { AppContext } from "../types/context";
import {
  createMutatingAuthMiddleware,
  createMutatingRateLimitMiddleware,
  resetMutatingRateLimitStoreForTests,
} from "./security-middleware";

function createContext(apiKey?: string): AppContext {
  return {
    config: {
      host: "0.0.0.0",
      port: 8080,
      inference_port: 8000,
      data_dir: "/tmp",
      db_path: "/tmp/controller.db",
      models_dir: "/tmp/models",
      strict_openai_models: false,
      daytona_agent_mode: false,
      ...(apiKey ? { api_key: apiKey } : {}),
    },
    logger: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
  } as unknown as AppContext;
}

describe("security middleware", () => {
  it("blocks mutating requests without API key when configured", async () => {
    resetMutatingRateLimitStoreForTests();
    const app = new Hono();
    const context = createContext("secret-token");

    app.use("*", createMutatingAuthMiddleware(context));
    app.post("/secure", (ctx) => ctx.json({ ok: true }));

    const response = await app.request("/secure", { method: "POST" });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ detail: "Unauthorized" });
  });

  it("accepts mutating requests with bearer token or x-api-key", async () => {
    resetMutatingRateLimitStoreForTests();
    const app = new Hono();
    const context = createContext("secret-token");

    app.use("*", createMutatingAuthMiddleware(context));
    app.post("/secure", (ctx) => ctx.json({ ok: true }));

    const bearer = await app.request("/secure", {
      method: "POST",
      headers: { Authorization: "Bearer secret-token" },
    });
    expect(bearer.status).toBe(200);

    const apiKeyHeader = await app.request("/secure", {
      method: "POST",
      headers: { "X-API-Key": "secret-token" },
    });
    expect(apiKeyHeader.status).toBe(200);
  });

  it("does not require auth when API key is not configured", async () => {
    resetMutatingRateLimitStoreForTests();
    const app = new Hono();
    const context = createContext();

    app.use("*", createMutatingAuthMiddleware(context));
    app.post("/secure", (ctx) => ctx.json({ ok: true }));

    const response = await app.request("/secure", { method: "POST" });
    expect(response.status).toBe(200);
  });

  it("rate limits mutating requests only", async () => {
    resetMutatingRateLimitStoreForTests();
    const app = new Hono();
    const context = createContext();

    app.use("*", createMutatingRateLimitMiddleware(context, { maxRequests: 2, windowMs: 60_000 }));
    app.get("/secure", (ctx) => ctx.json({ ok: true }));
    app.post("/secure", (ctx) => ctx.json({ ok: true }));

    const getResponse = await app.request("/secure", { method: "GET" });
    expect(getResponse.status).toBe(200);

    const first = await app.request("/secure", {
      method: "POST",
      headers: { "X-Forwarded-For": "203.0.113.7" },
    });
    expect(first.status).toBe(200);

    const second = await app.request("/secure", {
      method: "POST",
      headers: { "X-Forwarded-For": "203.0.113.7" },
    });
    expect(second.status).toBe(200);

    const third = await app.request("/secure", {
      method: "POST",
      headers: { "X-Forwarded-For": "203.0.113.7" },
    });
    expect(third.status).toBe(429);
    expect(await third.json()).toEqual({ detail: "Rate limit exceeded" });
  });
});
