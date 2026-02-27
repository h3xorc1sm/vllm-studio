import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApiCore } from "./core";
import { clearStoredBackendUrl, getStoredBackendUrl } from "../backend-url";

vi.mock("../backend-url", () => ({
  getStoredBackendUrl: vi.fn(),
  clearStoredBackendUrl: vi.fn(),
}));

vi.mock("../api-key", () => ({
  getApiKey: vi.fn(() => ""),
}));

const getStoredBackendUrlMock = vi.mocked(getStoredBackendUrl);
const clearStoredBackendUrlMock = vi.mocked(clearStoredBackendUrl);

describe("createApiCore", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getStoredBackendUrlMock.mockReturnValue("http://localhost:8080");
  });

  it("clears stale backend override when proxy marks it invalid", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Backend-Override-Invalid": "1",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const core = createApiCore({ baseUrl: "/api/proxy", useProxy: true });
    await core.request("/status", { retries: 0 });

    expect(clearStoredBackendUrlMock).toHaveBeenCalledTimes(1);
  });

  it("does not clear backend override when no invalid marker is present", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const core = createApiCore({ baseUrl: "/api/proxy", useProxy: true });
    await core.request("/status", { retries: 0 });

    expect(clearStoredBackendUrlMock).not.toHaveBeenCalled();
  });
});
