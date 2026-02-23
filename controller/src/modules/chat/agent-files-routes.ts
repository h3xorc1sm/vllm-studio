// CRITICAL
import type { Hono } from "hono";
import { posix } from "node:path";
import type { AppContext } from "../../types/context";
import { badRequest, notFound } from "../../core/errors";
import { getAgentFs } from "./agent-fs-store";
import { Event } from "../monitoring/event-manager";
import { buildAgentFileTree, mkdirp, normalizeAgentPath, toFsPath } from "./agent/agent-fs-helpers";
import type { AgentFsApi } from "./agent/agent-fs-interfaces";

/**
 * Extract the wildcard path from the URL.
 * Hono's param("*") doesn't work reliably with certain route patterns,
 * so we manually extract the path after /files/.
 * @param urlPath - The full URL path from the request
 * @param sessionId - The chat session ID
 * @returns The extracted file path, or empty string if not found
 */
const extractFilePath = (urlPath: string, sessionId: string): string => {
  const prefix = `/chats/${sessionId}/files/`;
  const prefixIndex = urlPath.indexOf(prefix);
  if (prefixIndex === -1) return "";
  const rest = urlPath.slice(prefixIndex + prefix.length);
  // Decode URI components to handle encoded characters
  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
};

const normalizeRoutePath = (rawPath: string): string => {
  try {
    return normalizeAgentPath(rawPath);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid path") {
      throw badRequest("Invalid path");
    }
    throw error;
  }
};

export const registerAgentFilesRoutes = (app: Hono, context: AppContext): void => {
  const getSessionFs = async (sessionId: string): Promise<AgentFsApi> => {
    const agent = await getAgentFs(context, sessionId);
    return agent.fs as AgentFsApi;
  };

  app.get("/chats/:sessionId/files", async (ctx) => {
    const sessionId = ctx.req.param("sessionId");
    const fs = await getSessionFs(sessionId);
    const pathParameter = ctx.req.query("path") ?? "";
    const recursive = ctx.req.query("recursive") !== "false";
    const normalized = normalizeRoutePath(pathParameter);
    try {
      const files = await buildAgentFileTree(fs, normalized, recursive);
      await context.eventManager.publish(
        new Event("agent_files_listed", {
          session_id: sessionId,
          path: normalized || null,
          recursive,
          files,
        })
      );
      return ctx.json({ files, path: normalized || undefined });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "ENOENT") throw notFound("Path not found");
      throw error;
    }
  });

  app.get("/chats/:sessionId/files/*", async (ctx) => {
    const sessionId = ctx.req.param("sessionId");
    const rawPath = extractFilePath(ctx.req.path, sessionId) || ctx.req.query("path") || "";
    if (!rawPath) throw badRequest("Path is required");
    const fs = await getSessionFs(sessionId);
    const normalized = normalizeRoutePath(rawPath);
    const target = toFsPath(normalized);
    const includeVersions =
      ctx.req.query("versions") === "true" ||
      ctx.req.query("versions") === "1" ||
      ctx.req.query("include_versions") === "true" ||
      ctx.req.query("include_versions") === "1";
    try {
      const stat = await fs.stat(target);
      if (stat.isDirectory()) throw badRequest("Path is a directory");
      const content = await fs.readFile(target, "utf8");
      await context.eventManager.publish(
        new Event("agent_file_read", {
          session_id: sessionId,
          path: normalized,
          bytes: Buffer.byteLength(content, "utf8"),
        })
      );
      if (!includeVersions) return ctx.json({ path: normalized, content });

      const rows = context.stores.chatStore.listAgentFileVersions(sessionId, normalized);
      const versions = rows
        .map((row) => ({
          version:
            typeof row["version"] === "number" ? row["version"] : Number(row["version"] ?? 0),
          content: typeof row["content"] === "string" ? row["content"] : "",
          timestamp:
            typeof row["created_at_ms"] === "number"
              ? row["created_at_ms"]
              : Number(row["created_at_ms"] ?? Date.now()),
        }))
        .filter((v) => Number.isFinite(v.version) && v.version > 0);

      return ctx.json({ path: normalized, content, versions });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "ENOENT") throw notFound("File not found");
      throw error;
    }
  });

  app.put("/chats/:sessionId/files/*", async (ctx) => {
    const sessionId = ctx.req.param("sessionId");
    const body = (await ctx.req.json()) as Record<string, unknown>;
    const rawPath =
      extractFilePath(ctx.req.path, sessionId) ||
      (typeof body["path"] === "string" ? String(body["path"]) : "") ||
      ctx.req.query("path") ||
      "";
    if (!rawPath) throw badRequest("Path is required");
    const content = typeof body["content"] === "string" ? body["content"] : "";
    const encoding = body["encoding"] === "base64" ? "base64" : "utf8";
    const fs = await getSessionFs(sessionId);
    const normalized = normalizeRoutePath(rawPath);
    const target = toFsPath(normalized);
    const data = encoding === "base64" ? Buffer.from(content, "base64") : content;
    await fs.writeFile(target, data);
    const byteLength = typeof data === "string" ? Buffer.byteLength(data, "utf8") : data.length;
    // Persist a snapshot for sidebar versioning (v1/v2/...).
    context.stores.chatStore.addAgentFileVersion(sessionId, normalized, content, byteLength);
    await context.eventManager.publish(
      new Event("agent_file_written", {
        session_id: sessionId,
        path: normalized,
        bytes: byteLength,
        encoding,
      })
    );
    return ctx.json({ success: true });
  });

  app.delete("/chats/:sessionId/files/*", async (ctx) => {
    const sessionId = ctx.req.param("sessionId");
    const rawPath = extractFilePath(ctx.req.path, sessionId) || ctx.req.query("path") || "";
    if (!rawPath) throw badRequest("Path is required");
    const fs = await getSessionFs(sessionId);
    const normalized = normalizeRoutePath(rawPath);
    const target = toFsPath(normalized);
    await fs.rm(target, { recursive: true, force: true });
    context.stores.chatStore.deleteAgentFileVersionsForPath(sessionId, normalized);
    await context.eventManager.publish(
      new Event("agent_file_deleted", { session_id: sessionId, path: normalized })
    );
    return ctx.json({ success: true });
  });

  app.post("/chats/:sessionId/files/dir", async (ctx) => {
    const sessionId = ctx.req.param("sessionId");
    const body = (await ctx.req.json()) as Record<string, unknown>;
    const rawPath = typeof body["path"] === "string" ? body["path"] : "";
    if (!rawPath) throw badRequest("Path is required");
    const fs = await getSessionFs(sessionId);
    const normalized = normalizeRoutePath(rawPath);
    await mkdirp(fs, normalized);
    await context.eventManager.publish(
      new Event("agent_directory_created", { session_id: sessionId, path: normalized })
    );
    return ctx.json({ success: true });
  });

  app.post("/chats/:sessionId/files/move", async (ctx) => {
    const sessionId = ctx.req.param("sessionId");
    const body = (await ctx.req.json()) as Record<string, unknown>;
    const from = typeof body["from"] === "string" ? body["from"] : "";
    const to = typeof body["to"] === "string" ? body["to"] : "";
    if (!from || !to) throw badRequest("from and to are required");
    const fs = await getSessionFs(sessionId);
    const normalizedFrom = normalizeRoutePath(from);
    const normalizedTo = normalizeRoutePath(to);
    const targetDirectory = posix.dirname(normalizedTo);
    if (targetDirectory && targetDirectory !== ".") {
      await mkdirp(fs, targetDirectory);
    }
    await fs.rename(toFsPath(normalizedFrom), toFsPath(normalizedTo));
    context.stores.chatStore.moveAgentFileVersions(sessionId, normalizedFrom, normalizedTo);
    await context.eventManager.publish(
      new Event("agent_file_moved", {
        session_id: sessionId,
        from: normalizedFrom,
        to: normalizedTo,
      })
    );
    return ctx.json({ success: true });
  });
};
