// CRITICAL
"use client";

import { memo, useCallback, useMemo, useState } from "react";
import type { ActivityItem } from "@/app/chat/types";
import { safeJsonStringify } from "@/lib/safe-json";

interface ToolItemProps {
  item: ActivityItem;
}

function getToolDisplayName(name?: string) {
  if (!name) return "Tool";
  const cleanName = name.includes("__") ? name.split("__").slice(1).join("__") : name;
  return cleanName
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function getMainArg(input?: unknown): string | undefined {
  if (input == null) return undefined;
  if (typeof input === "string") return input;
  if (typeof input === "object") {
    const record = input as Record<string, unknown>;
    const candidate =
      record.query ?? record.url ?? record.text ?? record.input ?? record.path ?? record.command;
    return candidate != null ? String(candidate) : undefined;
  }
  return undefined;
}

function formatToolOutput(output?: unknown): string {
  if (!output) return "";
  if (typeof output === "string") return output;
  return safeJsonStringify(output, "");
}

function getStateLabel(item: ActivityItem): string {
  if (item.state === "running") return "Running";
  if (item.state === "error") return "Error";
  if (item.state === "complete") return "Done";
  return "Queued";
}

export const ToolItem = memo(
  function ToolItem({ item }: ToolItemProps) {
    const [expanded, setExpanded] = useState(false);
    const hasDetails = item.input != null || item.output != null;
    const isError = item.state === "error";

    const toggleExpanded = useCallback(() => {
      if (!hasDetails) return;
      setExpanded((prev) => !prev);
    }, [hasDetails]);

    const mainArg = useMemo(() => getMainArg(item.input), [item.input]);
    const toolName = useMemo(() => getToolDisplayName(item.toolName), [item.toolName]);
    const outputText = useMemo(() => {
      if (!expanded) return "";
      return formatToolOutput(item.output);
    }, [expanded, item.output]);

    return (
      <div className="relative pl-7 pr-1 py-2">
        <span className="absolute left-3.5 top-3.5 h-1.25 w-1.25 rounded-full bg-(--fg)/35" />
        <button onClick={toggleExpanded} className="flex items-baseline gap-2 w-full text-left">
          <span className="text-base leading-tight text-(--fg) truncate">{toolName}</span>
          <span className="text-sm text-(--fg)/60">{getStateLabel(item)}</span>
          {hasDetails && (
            <span className="ml-auto text-sm text-(--fg)/60">{expanded ? "Less" : "More"}</span>
          )}
        </button>

        {mainArg && (
          <p className="mt-1 text-sm leading-relaxed text-(--fg)/70 line-clamp-2">{mainArg.slice(0, 200)}</p>
        )}

        {expanded && (
          <div className="mt-2 space-y-2">
            {item.input != null && (
              <div>
                <span className="text-sm text-(--fg)/70">Input</span>
                <pre className="mt-1 max-h-24 overflow-x-auto overflow-y-auto text-sm leading-relaxed text-(--fg)/80 font-mono whitespace-pre-wrap break-words">
                  {String(safeJsonStringify(item.input, ""))}
                </pre>
              </div>
            )}
            {outputText && (
              <div>
                <span className="text-sm text-(--fg)/70">{isError ? "Output (error)" : "Output"}</span>
                <pre className="mt-1 max-h-40 overflow-x-auto overflow-y-auto text-sm leading-relaxed text-(--fg)/80 font-mono whitespace-pre-wrap break-words">
                  {outputText.slice(0, 500)}
                  {outputText.length > 500 ? "..." : ""}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
  function areToolItemPropsEqual(prev, next) {
    const a = prev.item;
    const b = next.item;
    return (
      a.id === b.id &&
      a.type === b.type &&
      a.toolName === b.toolName &&
      a.state === b.state &&
      a.isActive === b.isActive &&
      a.content === b.content &&
      a.input === b.input &&
      a.output === b.output
    );
  },
);
