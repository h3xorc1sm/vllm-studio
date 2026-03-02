// CRITICAL
import { NextRequest, NextResponse } from "next/server";
import { getApiSettings } from "@/lib/api-settings";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return handleRequest(request, "GET", path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return handleRequest(request, "POST", path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return handleRequest(request, "PUT", path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return handleRequest(request, "DELETE", path);
}

function getClientInfo(request: NextRequest) {
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    request.headers.get("X-Real-IP") ||
    "unknown";
  const country = request.headers.get("CF-IPCountry") || "-";
  const ua = request.headers.get("User-Agent")?.slice(0, 80) || "unknown";
  return { ip, country, ua };
}

function normalizeBackendUrl(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "0.0.0.0") return true;
    if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return true;
    // Check private IP ranges
    const parts = hostname.split(".");
    if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
      const [a, b] = parts.map(Number);
      if (a === 10) return true;
      if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true;
    }
    return false;
  } catch {
    return true;
  }
}

function buildTargetUrl(backendUrl: string, path: string[], searchParams: string): string {
  return `${backendUrl}/${path.join("/")}${searchParams ? `?${searchParams}` : ""}`;
}

function shouldFallbackFromResponse(response: Response): boolean {
  if (response.ok) return false;
  if (response.status !== 404) return false;
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("text/plain");
}

async function fetchWithOptionalFallback(
  primaryUrl: string,
  fallbackUrl: string | null,
  init: RequestInit,
  context: {
    client: { ip: string; country: string; ua: string };
    method: string;
    path: string[];
    overrideUsed: boolean;
  },
): Promise<{ response: Response; usedFallback: boolean }> {
  const canFallback = Boolean(context.overrideUsed && fallbackUrl && fallbackUrl !== primaryUrl);

  try {
    const primaryResponse = await fetch(primaryUrl, init);
    if (canFallback && shouldFallbackFromResponse(primaryResponse)) {
      console.warn(
        `[PROXY FALLBACK] ip=${context.client.ip} | country=${context.client.country} | method=${context.method} | path=/${context.path.join("/")} | reason=override-404-text`,
      );
      return { response: await fetch(fallbackUrl as string, init), usedFallback: true };
    }
    return { response: primaryResponse, usedFallback: false };
  } catch (error) {
    if (!canFallback) throw error;
    console.warn(
      `[PROXY FALLBACK] ip=${context.client.ip} | country=${context.client.country} | method=${context.method} | path=/${context.path.join("/")} | reason=override-network-error | error=${String(error)}`,
    );
    return { response: await fetch(fallbackUrl as string, init), usedFallback: true };
  }
}

async function handleRequest(request: NextRequest, method: string, path: string[]) {
  const startTime = Date.now();
  const client = getClientInfo(request);

  try {
    // Get dynamic settings
    const settings = await getApiSettings();
    const overrideHeaderUrl = normalizeBackendUrl(request.headers.get("x-backend-url"));
    const overrideCookieUrl = normalizeBackendUrl(
      request.cookies.get("vllmstudio_backend_url")?.value ?? null,
    );
    const defaultBackendUrl = normalizeBackendUrl(settings.backendUrl) ?? settings.backendUrl;
    const overrideUrl = overrideHeaderUrl ?? overrideCookieUrl;
    if (overrideUrl && isPrivateUrl(overrideUrl)) {
      console.warn(
        `[PROXY BLOCKED] ip=${client.ip} | override=${overrideUrl} | reason=private-address`,
      );
      return NextResponse.json(
        { error: "Backend override blocked: private/local addresses not allowed" },
        { status: 403 },
      );
    }
    const backendUrl = overrideUrl ?? defaultBackendUrl;
    const API_KEY = settings.apiKey;

    const url = new URL(request.url);
    const forwardedParams = new URLSearchParams(url.searchParams);
    const apiKeyQuery = forwardedParams.get("api_key");
    // Never forward credentials to the controller as query params.
    if (apiKeyQuery) forwardedParams.delete("api_key");
    const searchParams = forwardedParams.toString();
    const targetUrl = buildTargetUrl(backendUrl, path, searchParams);
    const fallbackTargetUrl =
      overrideUrl && defaultBackendUrl !== overrideUrl
        ? buildTargetUrl(defaultBackendUrl, path, searchParams)
        : null;
    const hasAuth = Boolean(request.headers.get("authorization"));

    console.log(
      `[PROXY] ip=${client.ip} | country=${client.country} | method=${method} | path=/${path.join("/")} | backend=${backendUrl} | override=${overrideUrl ? "yes" : "no"} | auth=${hasAuth ? "present" : "none"}`,
    );

    const headers: HeadersInit = {
      ...(request.headers.get("accept") ? { Accept: request.headers.get("accept") as string } : {}),
    };

    const incomingContentType = request.headers.get("content-type");
    if (incomingContentType) headers["Content-Type"] = incomingContentType;

    // Prefer per-user Authorization header passed from the browser; fallback to configured API key.
    const incomingAuth = request.headers.get("authorization");
    if (incomingAuth) {
      headers["Authorization"] = incomingAuth;
    } else if (apiKeyQuery) {
      headers["Authorization"] = `Bearer ${apiKeyQuery}`;
    } else if (API_KEY) {
      headers["Authorization"] = `Bearer ${API_KEY}`;
    }

    const body = method !== "GET" && method !== "DELETE" ? await request.text() : undefined;

    const { response, usedFallback } = await fetchWithOptionalFallback(
      targetUrl,
      fallbackTargetUrl,
      { method, headers, body },
      {
        client,
        method,
        path,
        overrideUsed: Boolean(overrideUrl),
      },
    );

    const contentType = response.headers.get("content-type") || "application/json";

    if (contentType.includes("text/event-stream") && response.body) {
      const runId = response.headers.get("x-run-id");
      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": response.headers.get("cache-control") || "no-cache",
          ...(usedFallback ? { "X-Backend-Override-Invalid": "1" } : {}),
          ...(usedFallback
            ? { "Set-Cookie": "vllmstudio_backend_url=; Path=/; Max-Age=0; SameSite=Lax" }
            : {}),
          ...(runId ? { "X-Run-Id": runId } : {}),
        },
      });
    }

    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
        ...(usedFallback ? { "X-Backend-Override-Invalid": "1" } : {}),
        ...(usedFallback
          ? { "Set-Cookie": "vllmstudio_backend_url=; Path=/; Max-Age=0; SameSite=Lax" }
          : {}),
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[PROXY ERROR] ip=${client.ip} | country=${client.country} | method=${method} | path=/${path.join("/")} | duration=${duration}ms | error=${String(error)}`,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
