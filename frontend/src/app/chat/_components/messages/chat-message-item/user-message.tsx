// CRITICAL
"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import * as Icons from "../../icons";

interface ImagePart {
  url: string;
  name?: string;
}

export function UserMessage({
  messageId,
  textContent,
  images,
  copied,
  canActOnContent,
  onCopy,
  onExport,
  actionButtonClassName,
}: {
  messageId: string;
  textContent: string;
  images?: ImagePart[];
  copied: boolean;
  canActOnContent: boolean;
  onCopy: () => void;
  onExport: () => void;
  actionButtonClassName: string;
}) {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const hasImages = images && images.length > 0;

  const handleImageClick = useCallback((url: string) => {
    setExpandedImage((prev) => (prev === url ? null : url));
  }, []);

  const imageGrid = hasImages ? (
    <div className={`flex flex-wrap gap-1.5 ${textContent ? "mb-1.5" : ""}`}>
      {images.map((img, i) => (
        <button
          key={i}
          onClick={() => handleImageClick(img.url)}
          className="relative rounded-lg overflow-hidden border border-white/10 hover:border-white/25 transition-colors cursor-pointer"
        >
          <Image
            src={img.url}
            alt={img.name ?? `Image ${i + 1}`}
            width={120}
            height={120}
            className="w-auto h-auto max-w-[120px] max-h-[120px] object-cover"
            unoptimized
          />
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div id={`message-${messageId}`} className="group">
      {/* Expanded image overlay */}
      {expandedImage && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setExpandedImage(null)}
            className="relative rounded-xl overflow-hidden border border-(--border) cursor-pointer"
          >
            <Image
              src={expandedImage}
              alt="Expanded"
              width={600}
              height={600}
              className="w-auto h-auto max-w-full max-h-[60vh] object-contain"
              unoptimized
            />
          </button>
        </div>
      )}

      {/* Mobile */}
      <div className="md:hidden flex justify-end">
        <div className="max-w-[85%] rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
          {imageGrid}
          {textContent && (
            <div className="text-[15px] leading-relaxed text-(--fg) whitespace-pre-wrap break-words">
              {textContent}
            </div>
          )}
          {!textContent && !hasImages && (
            <div className="text-[15px] leading-relaxed text-(--fg) whitespace-pre-wrap break-words" />
          )}
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:flex justify-end">
        <div className="ml-auto max-w-[62%] rounded-xl border border-(--border) bg-(--surface)/70 px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-[10px] uppercase tracking-[0.2em] text-(--dim)">You</div>
            <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={onCopy} disabled={!canActOnContent} className={actionButtonClassName} title="Copy">
                {copied ? (
                  <Icons.Check className="h-3.5 w-3.5 text-(--hl2)" />
                ) : (
                  <Icons.Copy className="h-3.5 w-3.5 text-(--dim)" />
                )}
              </button>
              <button onClick={onExport} disabled={!canActOnContent} className={actionButtonClassName} title="Export">
                <Icons.Download className="h-3.5 w-3.5 text-(--dim)" />
              </button>
            </div>
          </div>
          {imageGrid}
          {textContent && (
            <div className="text-[15px] leading-relaxed text-(--fg) whitespace-pre-wrap break-words">
              {textContent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
