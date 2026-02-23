// CRITICAL
import { posix } from "node:path";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TSchema } from "@sinclair/typebox";
import type { AppContext } from "../../../types/context";
import { getAgentFs } from "../agent-fs-store";
import { Event } from "../../monitoring/event-manager";
import { createTextResult } from "./tool-registry-common";
import type { AgentToolRegistryOptions } from "./tool-registry";
import {
  buildAgentFileTree,
  mkdirp,
  normalizeAgentPath,
  toFsPath,
} from "./agent-fs-helpers";
import type { AgentFsApi } from "./agent-fs-interfaces";

/**
 * Build agent filesystem tools.
 * @param context - Application context.
 * @param options - Tool registry options.
 * @returns Agent tools.
 */
export const buildAgentFsTools = (
  context: AppContext,
  options: AgentToolRegistryOptions
): AgentTool[] => {
  const sessionId = options.sessionId;
  const emit = options.emitEvent;

  const withAgentFs = async <T>(operation: (fs: AgentFsApi) => Promise<T>): Promise<T> => {
    const agent = await getAgentFs(context, sessionId);
    return operation(agent.fs as AgentFsApi);
  };
  const publishAgentFsEvent = async (
    eventName: string,
    payload: Record<string, unknown>
  ): Promise<void> => {
    emit?.(eventName, payload);
    await context.eventManager.publish(new Event(eventName, payload));
  };

  const listFiles: AgentTool = {
    name: "list_files",
    label: "list_files",
    description: "List files in the agent workspace.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        recursive: { type: "boolean" },
      },
    } as unknown as TSchema,
    execute: async (_toolCallId, params): Promise<AgentToolResult<Record<string, unknown>>> => {
      const raw = params as Record<string, unknown>;
      const normalized = normalizeAgentPath(typeof raw["path"] === "string" ? raw["path"] : "");
      const recursive = raw["recursive"] !== false;
      const files = await withAgentFs((fs) => buildAgentFileTree(fs, normalized, recursive));
      await publishAgentFsEvent("agent_files_listed", {
        session_id: sessionId,
        path: normalized || null,
        recursive,
        files,
      });
      return createTextResult(JSON.stringify(files, null, 2), {
        files,
        path: normalized,
        recursive,
      });
    },
  };

  const readFile: AgentTool = {
    name: "read_file",
    label: "read_file",
    description: "Read a file from the agent workspace.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    } as unknown as TSchema,
    execute: async (_toolCallId, params): Promise<AgentToolResult<Record<string, unknown>>> => {
      const raw = params as Record<string, unknown>;
      const path = normalizeAgentPath(typeof raw["path"] === "string" ? raw["path"] : "");
      if (!path) throw new Error("Path is required.");
      const content = await withAgentFs((fs) => fs.readFile(toFsPath(path), "utf8"));
      const bytes = Buffer.byteLength(content, "utf8");
      await publishAgentFsEvent("agent_file_read", {
        session_id: sessionId,
        path,
        bytes,
      });
      return createTextResult(content, { path });
    },
  };

  const writeFile: AgentTool = {
    name: "write_file",
    label: "write_file",
    description:
      "Write or overwrite a file in the agent workspace. Parent directories are created automatically.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    } as unknown as TSchema,
    execute: async (_toolCallId, params): Promise<AgentToolResult<Record<string, unknown>>> => {
      const raw = params as Record<string, unknown>;
      const path = normalizeAgentPath(typeof raw["path"] === "string" ? raw["path"] : "");
      if (!path) throw new Error("Path is required.");
      const content = typeof raw["content"] === "string" ? raw["content"] : "";
      const parentDirectory = posix.dirname(path);
      if (parentDirectory && parentDirectory !== ".") {
        await withAgentFs((fs) => mkdirp(fs, parentDirectory));
      }
      await withAgentFs((fs) => fs.writeFile(toFsPath(path), content));
      context.stores.chatStore.addAgentFileVersion(
        sessionId,
        path,
        content,
        Buffer.byteLength(content, "utf8")
      );
      const bytes = Buffer.byteLength(content, "utf8");
      await publishAgentFsEvent("agent_file_written", {
        session_id: sessionId,
        path,
        bytes,
        encoding: "utf8",
      });
      return createTextResult(`Wrote ${path}`, { path });
    },
  };

  const deleteFile: AgentTool = {
    name: "delete_file",
    label: "delete_file",
    description: "Delete a file from the agent workspace.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    } as unknown as TSchema,
    execute: async (_toolCallId, params): Promise<AgentToolResult<Record<string, unknown>>> => {
      const raw = params as Record<string, unknown>;
      const path = normalizeAgentPath(typeof raw["path"] === "string" ? raw["path"] : "");
      if (!path) throw new Error("Path is required.");
      await withAgentFs((fs) => fs.rm(toFsPath(path), { recursive: true, force: true }));
      context.stores.chatStore.deleteAgentFileVersionsForPath(sessionId, path);
      await publishAgentFsEvent("agent_file_deleted", { session_id: sessionId, path });
      return createTextResult(`Deleted ${path}`, { path });
    },
  };

  const makeDirectory: AgentTool = {
    name: "make_directory",
    label: "make_directory",
    description: "Create a directory in the agent workspace.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    } as unknown as TSchema,
    execute: async (_toolCallId, params): Promise<AgentToolResult<Record<string, unknown>>> => {
      const raw = params as Record<string, unknown>;
      const path = normalizeAgentPath(typeof raw["path"] === "string" ? raw["path"] : "");
      if (!path) throw new Error("Path is required.");
      await withAgentFs((fs) => mkdirp(fs, path));
      await publishAgentFsEvent("agent_directory_created", { session_id: sessionId, path });
      return createTextResult(`Created directory ${path}`, { path });
    },
  };

  const moveFile: AgentTool = {
    name: "move_file",
    label: "move_file",
    description: "Move or rename a file in the agent workspace.",
    parameters: {
      type: "object",
      properties: { from: { type: "string" }, to: { type: "string" } },
      required: ["from", "to"],
    } as unknown as TSchema,
    execute: async (_toolCallId, params): Promise<AgentToolResult<Record<string, unknown>>> => {
      const raw = params as Record<string, unknown>;
      const from = normalizeAgentPath(typeof raw["from"] === "string" ? raw["from"] : "");
      const to = normalizeAgentPath(typeof raw["to"] === "string" ? raw["to"] : "");
      if (!from || !to) throw new Error("from and to are required.");
      const targetDirectory = posix.dirname(to);
      if (targetDirectory && targetDirectory !== ".") {
        await withAgentFs((fs) => mkdirp(fs, targetDirectory));
      }
      await withAgentFs((fs) => fs.rename(toFsPath(from), toFsPath(to)));
      context.stores.chatStore.moveAgentFileVersions(sessionId, from, to);
      await publishAgentFsEvent("agent_file_moved", { session_id: sessionId, from, to });
      return createTextResult(`Moved ${from} to ${to}`, { from, to });
    },
  };

  return [listFiles, readFile, writeFile, deleteFile, makeDirectory, moveFile];
};
