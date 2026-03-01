// CRITICAL
"use client";

import {
  forwardRef,
  useCallback,
  useDeferredValue,
  useMemo,
  type HTMLAttributes,
  type RefObject,
} from "react";
import { Virtuoso } from "react-virtuoso";
import { ChatMessageItem } from "./chat-message-item";
import { PerfProfiler } from "../perf/perf-profiler";
import { ChatRunStatusLine } from "./chat-run-status-line";
import { UiStatusPill } from "@/components/ui-kit";
import type { AgentFileEntry, Artifact, ChatMessage } from "@/lib/types";
import { fileIcon, flattenAgentFiles } from "./chat-message-list/agent-file-chips";
import { filterVisibleMessages } from "./chat-message-list/visible-messages";

type MessageGroup = { type: "single"; message: ChatMessage; messageIndex: number };

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  artifactsEnabled?: boolean;
  artifactsByMessage?: Map<string, Artifact[]>;
  selectedModel?: string;
  contextUsageLabel?: string | null;
  agentFiles?: AgentFileEntry[];
  selectedAgentFilePath?: string | null;
  onOpenAgentFile?: (path: string) => void;
  scrollParent?: HTMLElement | null;
  messagesEndRef?: RefObject<HTMLDivElement | null>;
  onFork?: (messageId: string) => void;
  onReprompt?: (messageId: string) => void;
  onListen?: (messageId: string) => void;
  listeningMessageId?: string | null;
  listeningPending?: boolean;
  onOpenContext?: () => void;
  runStatusLine?: string;
}

const VirtuosoList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={`flex flex-col gap-3 md:gap-4 ${className ?? ""}`} {...props} />
  ),
);

VirtuosoList.displayName = "VirtuosoList";

export function ChatMessageList({
  messages,
  isLoading,
  artifactsEnabled = false,
  artifactsByMessage,
  selectedModel,
  contextUsageLabel,
  agentFiles,
  selectedAgentFilePath,
  onOpenAgentFile,
  scrollParent,
  messagesEndRef,
  onFork,
  onReprompt,
  onListen,
  listeningMessageId,
  listeningPending,
  onOpenContext,
  runStatusLine,
}: ChatMessageListProps) {
  const lastRawMessageId = messages[messages.length - 1]?.id;

  // Filter out internal/continuation messages from display
  const visibleMessages = useMemo(
    () =>
      filterVisibleMessages({
        messages,
        isLoading,
        lastRawMessageId,
        artifactsByMessage,
      }),
    [artifactsByMessage, isLoading, lastRawMessageId, messages],
  );

  const deferredVisibleMessages = useDeferredValue(visibleMessages);
  const baseMessages = isLoading ? deferredVisibleMessages : visibleMessages;

  const messageGroups = useMemo<MessageGroup[]>(() => {
    const groups: MessageGroup[] = baseMessages.map((message, idx) => ({
      type: "single",
      message,
      messageIndex: idx,
    }));

    // While streaming, keep the last assistant message "live" (avoid deferred tearing).
    if (!isLoading) return groups;
    const liveLast = visibleMessages[visibleMessages.length - 1];
    if (!liveLast || liveLast.role !== "assistant") return groups;
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.type === "single" && lastGroup.message.id === liveLast.id) {
      return [...groups.slice(0, -1), { ...lastGroup, message: liveLast }];
    }
    return groups;
  }, [baseMessages, isLoading, visibleMessages]);

  const fileChips = useMemo(() => flattenAgentFiles(agentFiles ?? []), [agentFiles]);
  const hasAgentFiles = fileChips.length > 0 && onOpenAgentFile;

  const handleExport = useCallback(
    (payload: {
      messageId: string;
      role: "user" | "assistant";
      content: string;
      model?: string;
      totalTokens?: number;
    }) => {
      if (!payload.content.trim()) return;

      const headerLines = [
        `# ${payload.role === "assistant" ? "Assistant" : "User"} Message`,
        payload.model ? `Model: ${payload.model}` : null,
        payload.totalTokens ? `Total tokens: ${payload.totalTokens}` : null,
        `Exported: ${new Date().toLocaleString()}`,
        "",
      ].filter(Boolean);

      const md = [...headerLines, payload.content].join("\n");

      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `message-${payload.messageId}.md`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [],
  );

  const renderGroup = useCallback(
    (_index: number, group: MessageGroup) => {
      const message = group.message;
      return (
        <ChatMessageItem
          key={message.id}
          message={message}
          isStreaming={
            isLoading &&
            group.messageIndex === visibleMessages.length - 1 &&
            message.role === "assistant"
          }
          artifactsEnabled={artifactsEnabled}
          artifacts={artifactsByMessage?.get(message.id)}
          selectedModel={selectedModel}
          contextUsageLabel={contextUsageLabel}
          onOpenContext={onOpenContext}
          onFork={message.role === "assistant" ? onFork : undefined}
          onReprompt={message.role === "assistant" ? onReprompt : undefined}
          onListen={message.role === "assistant" ? onListen : undefined}
          isListening={message.id === listeningMessageId}
          isListenPending={message.id === listeningMessageId && Boolean(listeningPending)}
          onExport={handleExport}
        />
      );
    },
    [
      artifactsByMessage,
      artifactsEnabled,
      contextUsageLabel,
      handleExport,
      isLoading,
      onFork,
      onListen,
      onOpenContext,
      onReprompt,
      selectedModel,
      listeningMessageId,
      listeningPending,
      visibleMessages.length,
    ],
  );

  const Footer = useCallback(() => {
    return (
      <div className="pt-4">
        {!isLoading && runStatusLine?.trim() && <ChatRunStatusLine line={runStatusLine} />}

        {hasAgentFiles && onOpenAgentFile && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-(--dim) mb-2">
              Agent Files
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {fileChips.map((file) => {
                const Icon = fileIcon(file.name);
                const isSelected = selectedAgentFilePath === file.path;
                return (
                  <button
                    key={file.path}
                    onClick={() => onOpenAgentFile(file.path)}
                    className="cursor-pointer"
                    title={file.path}
                  >
                    <UiStatusPill
                      tone={isSelected ? "success" : "neutral"}
                      className={`gap-1.5 whitespace-nowrap transition-all ${
                        isSelected
                          ? "bg-(--surface)/70 text-(--fg) border-(--hl2)/60"
                          : "bg-background/40 text-(--dim) border-white/12 hover:text-(--fg) hover:bg-background/55"
                      }`}
                    >
                      <Icon className="h-3 w-3 shrink-0" />
                      <span className="max-w-[160px] truncate">{file.name}</span>
                    </UiStatusPill>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    );
  }, [
    fileChips,
    hasAgentFiles,
    isLoading,
    messagesEndRef,
    onOpenAgentFile,
    runStatusLine,
    selectedAgentFilePath,
  ]);

  const virtuosoComponents = useMemo(() => {
    return { List: VirtuosoList, Footer };
  }, [Footer]);

  const computeItemKey = useCallback((_index: number, group: MessageGroup) => {
    return group.message.id;
  }, []);

  const scrollParentElement = scrollParent ?? undefined;

  return (
    <div className="flex flex-col gap-3 md:gap-4 px-4 md:px-6 py-3 md:py-4 max-w-4xl mx-auto w-full">
      <PerfProfiler id="chat-message-list">
        <Virtuoso
          customScrollParent={scrollParentElement}
          data={messageGroups}
          itemContent={renderGroup}
          components={virtuosoComponents}
          computeItemKey={computeItemKey}
        />
      </PerfProfiler>
    </div>
  );
}
