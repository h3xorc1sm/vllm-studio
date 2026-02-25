// CRITICAL
"use client";

import { UiPulseLabel, UiTimelineMarker } from "@/components/ui-kit";

interface ChatRunStatusLineProps {
  line: string;
}

export function ChatRunStatusLine({ line }: ChatRunStatusLineProps) {
  if (!line.trim()) return null;

  return (
    <div className="py-1.5">
      <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-(--border) bg-(--surface) px-3 py-1.5 shadow-[0_0_18px_rgba(56,189,248,0.16)]">
        <span className="relative">
          <span className="absolute inset-0 inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-(--hl2) opacity-70" />
          <UiTimelineMarker
            tone="active"
            className="h-2.5 w-2.5 shrink-0"
            pulsing
            innerClassName="h-2.5 w-2.5"
          />
        </span>
        <UiPulseLabel className="truncate text-xs font-medium" tone="info">
          {line}
        </UiPulseLabel>
      </div>
    </div>
  );
}
