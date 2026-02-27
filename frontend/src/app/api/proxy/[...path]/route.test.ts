// CRITICAL
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { getApiSettings } from "@/lib/api-settings";

vi.mock("@/lib/api-settings", () => ({
  getApiSettings: vi.fn(),
}));

const getApiSettingsMock = vi.mocked(getApiSettings);

describe("GET /api/proxy/[...path]", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getApiSettingsMock.mockResolvedValue({
      backendUrl: "https://api.homelabai.org",
      apiKey: "test-key",
      voiceUrl: "",
      voiceModel: "whisper-large-v3-turbo",
    });
  });

  it("falls back to configured backend when cookie override returns plain-text 404", async () => {
    const upstreamFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("not found", {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ running: false, process: null, inference_port: 8000 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", upstreamFetch);

    const request = new NextRequest("http://localhost/api/proxy/status", {
      method: "GET",
      headers: {
        Cookie: "vllmstudio_backend_url=http%3A%2F%2Flocalhost%3A8080",
      },
    });

    const response = await GET(request, { params: Promise.resolve({ path: ["status"] }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-backend-override-invalid")).toBe("1");
    expect(response.headers.get("set-cookie")).toContain("vllmstudio_backend_url=");
    const payload = await response.json();
    expect(payload.running).toBe(false);

    expect(upstreamFetch).toHaveBeenCalledTimes(2);
    expect(upstreamFetch.mock.calls[0]?.[0]).toBe("http://localhost:8080/status");
    expect(upstreamFetch.mock.calls[1]?.[0]).toBe("https://api.homelabai.org/status");
  });

  it("falls back to configured backend when override request throws a network error", async () => {
    const upstreamFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("connect ECONNREFUSED"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", upstreamFetch);

    const request = new NextRequest("http://localhost/api/proxy/health", {
      method: "GET",
      headers: {
        Cookie: "vllmstudio_backend_url=http%3A%2F%2Flocalhost%3A8080",
      },
    });

    const response = await GET(request, { params: Promise.resolve({ path: ["health"] }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-backend-override-invalid")).toBe("1");
    expect(response.headers.get("set-cookie")).toContain("vllmstudio_backend_url=");
    const payload = await response.json();
    expect(payload.status).toBe("ok");

    expect(upstreamFetch).toHaveBeenCalledTimes(2);
    expect(upstreamFetch.mock.calls[0]?.[0]).toBe("http://localhost:8080/health");
    expect(upstreamFetch.mock.calls[1]?.[0]).toBe("https://api.homelabai.org/health");
  });

  it("uses override when it succeeds and does not fallback", async () => {
    const upstreamFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ running: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", upstreamFetch);

    const request = new NextRequest("http://localhost/api/proxy/status", {
      method: "GET",
      headers: {
        "X-Backend-Url": "https://override.example.com",
      },
    });

    const response = await GET(request, { params: Promise.resolve({ path: ["status"] }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-backend-override-invalid")).toBeNull();
    const payload = await response.json();
    expect(payload.running).toBe(true);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    expect(upstreamFetch).toHaveBeenCalledWith(
      "https://override.example.com/status",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
