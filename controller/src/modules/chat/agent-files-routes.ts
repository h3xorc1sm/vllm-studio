// CRITICAL
import type { Hono } from "hono";
import type { AppContext } from "../../types/context";
import { badRequest, notFound } from "../../core/errors";
import { AGENT_FILE_EVENT_TYPES } from "./agent/contracts";
import { Event } from "../monitoring/event-manager";
import {
  createAgentDirectory,
  deleteAgentPath,
  getSessionAgentFs,
  listAgentFiles,
  moveAgentPath,
  readAgentFile,
  writeAgentFile,
} from "./agent-files/service";
import { toFsPath, normalizeAgentPath } from "./agent-files/helpers";
import type { AgentFsApi } from "./agent-files/types";

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
    return getSessionAgentFs(context, sessionId);
  };

  app.get("/chats/:sessionId/files", async (ctx) => {
    const sessionId = ctx.req.param("sessionId");
    const pathParameter = ctx.req.query("path") ?? "";
    const recursive = ctx.req.query("recursive") !== "false";
    const normalized = normalizeRoutePath(pathParameter);
    try {
      const files = await listAgentFiles(context, sessionId, normalized, recursive);
      await context.eventManager.publish(
        new Event(AGENT_FILE_EVENT_TYPES.AGENT_FILES_LISTED, {
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
      const { normalizedPath, content } = await readAgentFile(context, sessionId, normalized);
      await context.eventManager.publish(
        new Event(AGENT_FILE_EVENT_TYPES.AGENT_FILE_READ, {
          session_id: sessionId,
          path: normalizedPath,
          bytes: Buffer.byteLength(content, "utf8"),
        })
      );
      if (!includeVersions) return ctx.json({ path: normalizedPath, content });

      const rows = context.stores.chatStore.listAgentFileVersions(sessionId, normalizedPath);
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

      return ctx.json({ path: normalizedPath, content, versions });
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
    const data = encoding === "base64" ? Buffer.from(content, "base64") : content;
    const { normalizedPath, bytes } = await writeAgentFile(context, sessionId, rawPath, data);
    // Persist a snapshot for sidebar versioning (v1/v2/...).
    context.stores.chatStore.addAgentFileVersion(sessionId, normalizedPath, content, bytes);
    await context.eventManager.publish(
      new Event(AGENT_FILE_EVENT_TYPES.AGENT_FILE_WRITTEN, {
        session_id: sessionId,
        path: normalizedPath,
        bytes,
        encoding,
      })
    );
    return ctx.json({ success: true });
  });

  app.delete("/chats/:sessionId/files/*", async (ctx) => {
    const sessionId = ctx.req.param("sessionId");
    const rawPath = extractFilePath(ctx.req.path, sessionId) || ctx.req.query("path") || "";
    if (!rawPath) throw badRequest("Path is required");
    const normalized = await deleteAgentPath(context, sessionId, rawPath);
    context.stores.chatStore.deleteAgentFileVersionsForPath(sessionId, normalized);
    await context.eventManager.publish(
      new Event(AGENT_FILE_EVENT_TYPES.AGENT_FILE_DELETED, { session_id: sessionId, path: normalized })
    );
    return ctx.json({ success: true });
  });

  app.post("/chats/:sessionId/files/dir", async (ctx) => {
    const sessionId = ctx.req.param("sessionId");
    const body = (await ctx.req.json()) as Record<string, unknown>;
    const rawPath = typeof body["path"] === "string" ? body["path"] : "";
    if (!rawPath) throw badRequest("Path is required");
    const normalized = await createAgentDirectory(context, sessionId, rawPath);
    await context.eventManager.publish(
      new Event(AGENT_FILE_EVENT_TYPES.AGENT_DIRECTORY_CREATED, { session_id: sessionId, path: normalized })
    );
    return ctx.json({ success: true });
  });

  app.post("/chats/:sessionId/files/move", async (ctx) => {
    const sessionId = ctx.req.param("sessionId");
    const body = (await ctx.req.json()) as Record<string, unknown>;
    const from = typeof body["from"] === "string" ? body["from"] : "";
    const to = typeof body["to"] === "string" ? body["to"] : "";
    if (!from || !to) throw badRequest("from and to are required");
    const payload = await moveAgentPath(context, sessionId, from, to);
    context.stores.chatStore.moveAgentFileVersions(sessionId, payload.from, payload.to);
    await context.eventManager.publish(
      new Event(AGENT_FILE_EVENT_TYPES.AGENT_FILE_MOVED, {
        session_id: sessionId,
        from: payload.from,
        to: payload.to,
      })
    );
    return ctx.json({ success: true });
  });
};
