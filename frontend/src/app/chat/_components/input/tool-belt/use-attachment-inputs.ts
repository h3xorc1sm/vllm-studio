// CRITICAL
"use client";

import { useCallback, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from "react";
import type { Attachment } from "../../../types";
import { fileToBase64, maybeRevokeObjectUrl } from "./utils";

type UpdateAttachments = (updater: (prev: Attachment[]) => Attachment[]) => void;

type Args = {
  updateAttachments: UpdateAttachments;
};

const IMAGE_MIME_RE = /^image\//;
type AttachmentKind = "file" | "image";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function fileToAttachment(file: File, forcedType?: AttachmentKind): Promise<Attachment> {
  const isImage = forcedType ? forcedType === "image" : IMAGE_MIME_RE.test(file.type);
  const attachment: Attachment = {
    id: generateId(),
    type: isImage ? "image" : "file",
    name: file.name,
    size: file.size,
    url: isImage ? URL.createObjectURL(file) : undefined,
    file,
  };
  if (isImage) {
    try {
      attachment.base64 = await fileToBase64(file);
    } catch (err) {
      console.error("Failed to convert image to base64:", err);
    }
  }
  return attachment;
}

export function useAttachmentInputs({ updateAttachments }: Args) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const addFiles = useCallback(
    async (files: File[], forcedType?: AttachmentKind) => {
      if (files.length === 0) return;
      const attachments = await Promise.all(
        files.map((file) => fileToAttachment(file, forcedType)),
      );
      updateAttachments((prev) => [...prev, ...attachments]);
    },
    [updateAttachments],
  );

  const addAttachmentsFromInput = useCallback(
    async (e: ChangeEvent<HTMLInputElement>, type: "file" | "image") => {
      const files = Array.from(e.target.files || []);
      await addFiles(files, type);
      e.target.value = "";
    },
    [addFiles],
  );

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      void addAttachmentsFromInput(e, "file");
    },
    [addAttachmentsFromInput],
  );

  const handleImageInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      void addAttachmentsFromInput(e, "image");
    },
    [addAttachmentsFromInput],
  );

  const removeAttachment = useCallback(
    (id: string) => {
      updateAttachments((prev) => {
        const attachment = prev.find((a) => a.id === id);
        maybeRevokeObjectUrl(attachment?.url);
        return prev.filter((a) => a.id !== id);
      });
    },
    [updateAttachments],
  );

  const handleAttachFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleAttachImage = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  // --- Paste handler ---
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageFiles: File[] = [];
      for (const item of items) {
        if (IMAGE_MIME_RE.test(item.type)) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        void addFiles(imageFiles);
      }
      // Non-image pastes fall through to default textarea behavior
    },
    [addFiles],
  );

  // --- Drag & drop handlers ---
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) {
        void addFiles(files);
      }
    },
    [addFiles],
  );

  return {
    fileInputRef,
    imageInputRef,
    handleFileInputChange,
    handleImageInputChange,
    removeAttachment,
    handleAttachFile,
    handleAttachImage,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    isDragOver,
  };
}
