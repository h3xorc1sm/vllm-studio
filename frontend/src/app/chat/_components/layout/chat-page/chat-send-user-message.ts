// CRITICAL
"use client";

import { useCallback, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import api from "@/lib/api";
import { createUuid } from "@/lib/uuid";
import type { ChatMessage, ChatMessagePart } from "@/lib/types";
import type { Attachment } from "@/app/chat/types";
import { parseChatModelId } from "@/app/chat/types";
import {
  buildAttachmentsBlock,
  readAttachmentContent,
  sanitizeAttachmentName,
  type UploadedAttachment,
} from "@/app/chat/utils/chat-attachments";
import { buildRunSystemPrompt } from "./run-system-prompt";

export interface UseChatSendUserMessageArgs {
  selectedModel: string;
  systemPrompt: string;
  deepResearchEnabled: boolean;
  agentMode: boolean;
  currentSessionId: string | null;
  currentSessionTitle: string;
  isLoading: boolean;
  agentFiles: Array<{ name: string; type: "file" | "dir"; children?: unknown[] }>;
  agentFileVersions: Record<string, unknown>;
  setInput: (value: string) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setStreamError: (value: string | null) => void;
  setStreamingStartTime: (value: number | null) => void;
  lastUserInputRef: MutableRefObject<string>;
  createSession: (title: string, model: string) => Promise<{ id: string } | null>;
  setLastSessionId: (id: string) => void;
  replaceUrlToSession: (sessionId: string) => void;
  generateTitle: (
    sessionId: string,
    userContent: string,
    assistantContent: string,
  ) => Promise<string | null>;
  startRunStream: (
    sessionId: string,
    payload: {
      content: string;
      message_id: string;
      model?: string;
      provider?: string;
      system?: string;
      agent_mode?: boolean;
      agent_files?: boolean;
      deep_research?: boolean;
      images?: Array<{ data: string; mimeType: string; name?: string }>;
    },
  ) => Promise<void>;
  loadAgentFiles: (args: { sessionId: string }) => void;
}

export function useChatSendUserMessage({
  selectedModel,
  systemPrompt,
  deepResearchEnabled,
  agentMode,
  currentSessionId,
  currentSessionTitle,
  isLoading,
  agentFiles,
  agentFileVersions,
  setInput,
  setMessages,
  setStreamError,
  setStreamingStartTime,
  lastUserInputRef,
  createSession,
  setLastSessionId,
  replaceUrlToSession,
  generateTitle,
  startRunStream,
  loadAgentFiles,
}: UseChatSendUserMessageArgs) {
  const isSendingRef = useRef(false);

  const uploadAttachments = useCallback(
    async (
      sessionId: string,
      attachments: Attachment[],
    ): Promise<{
      uploaded: UploadedAttachment[];
      failures: Array<{ name: string; error: string }>;
    }> => {
      if (attachments.length === 0) {
        return { uploaded: [], failures: [] };
      }

      const datePrefix = new Date().toISOString().slice(0, 10);
      const baseDir = `uploads/${datePrefix}`;

      const results = await Promise.all(
        attachments.map(async (attachment, index) => {
          try {
            const safeName = sanitizeAttachmentName(attachment.name || `attachment-${index + 1}`);
            const { content, encoding } = await readAttachmentContent(attachment);
            const fileName = `${createUuid()}-${safeName}${encoding === "base64" ? ".base64" : ""}`;
            const path = `${baseDir}/${fileName}`;
            await api.writeAgentFile(sessionId, path, { content });
            return {
              ok: true as const,
              entry: {
                name: attachment.name || safeName,
                path,
                size: attachment.size,
                type: attachment.type,
                encoding,
              },
            };
          } catch (error) {
            return {
              ok: false as const,
              name: attachment.name || `attachment-${index + 1}`,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      );

      const uploaded = results.flatMap((result) => (result.ok ? [result.entry] : []));
      const failures = results.flatMap((result) =>
        result.ok ? [] : [{ name: result.name, error: result.error }],
      );

      if (uploaded.length > 0) {
        void loadAgentFiles({ sessionId });
      }

      return { uploaded, failures };
    },
    [loadAgentFiles],
  );

  const sendUserMessage = useCallback(
    async (text: string, attachments?: Attachment[], options?: { clearInput?: boolean }) => {
      const safeText = text.trim();
      const safeAttachments = attachments ?? [];
      const imageAttachments = safeAttachments.filter((a) => a.type === "image");
      const fileAttachments = safeAttachments.filter((a) => a.type !== "image");
      const attachmentFallbackPrompt =
        safeText.length > 0 ? null : safeAttachments.length > 0 ? "Sent attachment(s)." : null;

      if (!safeText && safeAttachments.length === 0) return;
      if (isLoading || isSendingRef.current) return;
      isSendingRef.current = true;
      setStreamingStartTime(Date.now());
      setStreamError(null);

      if (options?.clearInput) {
        setInput("");
      }

      try {
        const messageText = safeText || attachmentFallbackPrompt || "";
        lastUserInputRef.current = messageText;

        const payloadImages: Array<{ data: string; mimeType: string; name?: string }> = [];

        // Build parts for local display
        const parts: ChatMessagePart[] = [];
        if (messageText) {
          parts.push({ type: "text", text: messageText });
        }
        for (const img of imageAttachments) {
          let imageBase64 = img.base64;
          if (!imageBase64 && img.file) {
            const attachmentContent = await readAttachmentContent(img);
            imageBase64 = attachmentContent.content;
          }
          if (!imageBase64) continue;

          parts.push({
            type: "image",
            url: img.url ?? `data:${img.file?.type ?? "image/png"};base64,${imageBase64}`,
            name: img.name,
            mimeType: img.file?.type ?? "image/png",
          } as ChatMessagePart);

          payloadImages.push({
            data: imageBase64,
            mimeType: img.file?.type ?? "image/png",
            name: img.name,
          });
        }
        for (const att of fileAttachments) {
          parts.push({ type: "text", text: `[File: ${att.name}]` });
        }

        const messageId = createUuid();
        const userMessage: ChatMessage = {
          id: messageId,
          role: "user",
          parts,
        };

        setMessages((prev) => [...prev, userMessage]);
        const removeLocalMessage = () => {
          setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
        };

        let sessionId = currentSessionId;
        if (!sessionId) {
          const session = await createSession("New Chat", selectedModel);
          if (!session) {
            removeLocalMessage();
            setStreamError("Failed to start a new chat session");
            return;
          }
          sessionId = session.id;
          setLastSessionId(sessionId);
          replaceUrlToSession(sessionId);
        }

        // Title as soon as the first user message lands (prefer LLM, fallback heuristic).
        if (
          sessionId &&
          (currentSessionTitle === "New Chat" || currentSessionTitle === "Chat") &&
          safeText
        ) {
          void generateTitle(sessionId, messageText, "");
        }

        // Upload non-image files to agent filesystem
        let attachmentsBlock: string | undefined;
        const hasAgentFiles = agentFiles.length > 0 || Object.keys(agentFileVersions).length > 0;
        let agentFilesEnabled = hasAgentFiles;
        if (fileAttachments.length > 0) {
          const { uploaded, failures } = await uploadAttachments(sessionId, fileAttachments);
          if (uploaded.length > 0) {
            attachmentsBlock = buildAttachmentsBlock(uploaded);
            agentFilesEnabled = true;
          }
          if (failures.length > 0) {
            const names = failures.map((failure) => failure.name).join(", ");
            setStreamError(`Failed to upload ${failures.length} attachment(s): ${names}`);
            if (uploaded.length === 0 && payloadImages.length === 0) {
              removeLocalMessage();
              return;
            }
          }
        }

        const runSystemPrompt = attachmentsBlock
          ? buildRunSystemPrompt(systemPrompt, attachmentsBlock)
          : systemPrompt.trim() || undefined;
        const modelHint = (selectedModel || "").trim();
        const parsedModel = parseChatModelId(modelHint);
        const runModel = parsedModel.id.length > 0 ? parsedModel.id : undefined;
        const runProvider = runModel ? parsedModel.provider : undefined;

        try {
          await startRunStream(sessionId, {
            content: messageText,
            message_id: messageId,
            ...(runModel ? { model: runModel } : {}),
            ...(runProvider ? { provider: runProvider } : {}),
            system: runSystemPrompt,
            agent_mode: agentMode,
            agent_files: agentFilesEnabled,
            deep_research: deepResearchEnabled,
            ...(payloadImages.length > 0 ? { images: payloadImages } : {}),
          });
        } catch (error) {
          const shouldRollback =
            (
              error as {
                rollbackOptimisticUserMessage?: boolean;
              }
            )?.rollbackOptimisticUserMessage === true;
          if (shouldRollback) {
            removeLocalMessage();
          }
          throw error;
        }
      } finally {
        isSendingRef.current = false;
      }
    },
    [
      agentFileVersions,
      agentFiles,
      agentMode,
      createSession,
      currentSessionId,
      currentSessionTitle,
      deepResearchEnabled,
      generateTitle,
      isLoading,
      lastUserInputRef,
      replaceUrlToSession,
      selectedModel,
      setInput,
      setLastSessionId,
      setMessages,
      setStreamError,
      setStreamingStartTime,
      startRunStream,
      systemPrompt,
      uploadAttachments,
    ],
  );

  return { sendUserMessage };
}
