// CRITICAL
"use client";

import type { CSSProperties, ReactNode } from "react";
import { resolveUiToneConfig } from "./configs";
import type { UiTone } from "./types";

function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

interface UiPanelSurfaceProps {
  children: ReactNode;
  className?: string;
}

export function UiPanelSurface({ children, className }: UiPanelSurfaceProps) {
  return (
    <div
      className={joinClassNames("rounded-lg border border-(--border) bg-(--surface)", className)}
    >
      {children}
    </div>
  );
}

interface UiStatusBadgeProps {
  children: ReactNode;
  tone?: UiTone;
  className?: string;
  style?: CSSProperties;
}

export function UiStatusBadge({
  children,
  tone = "neutral",
  className,
  style,
}: UiStatusBadgeProps) {
  const toneConfig = resolveUiToneConfig(tone);
  const toneStyle: CSSProperties = {
    color: `var(${toneConfig.dotVar})`,
    backgroundColor: `color-mix(in srgb, var(${toneConfig.dotVar}) 12%, transparent)`,
  };

  return (
    <span
      className={joinClassNames("text-[9px] px-1.5 py-0.5 rounded-full", className)}
      style={{ ...toneStyle, ...(style ?? {}) }}
    >
      {children}
    </span>
  );
}

interface UiTimelineMarkerProps {
  tone?: UiTone;
  pulsing?: boolean;
  showDot?: boolean;
  className?: string;
  innerClassName?: string;
  children?: ReactNode;
}

export function UiTimelineMarker({
  tone = "neutral",
  pulsing = false,
  showDot = true,
  className,
  innerClassName,
  children,
}: UiTimelineMarkerProps) {
  const toneConfig = resolveUiToneConfig(tone);
  const markerStyle: CSSProperties = {
    borderColor: `var(${toneConfig.borderVar})`,
    backgroundColor: "var(--surface)",
  };

  if (children) {
    return (
      <div
        className={joinClassNames(
          "rounded-full border flex items-center justify-center",
          className,
        )}
        style={markerStyle}
      >
        {children}
      </div>
    );
  }

  const dotStyle: CSSProperties = {
    backgroundColor: `var(${toneConfig.dotVar})`,
  };

  return (
    <div
      className={joinClassNames("rounded-full border flex items-center justify-center", className)}
      style={markerStyle}
    >
      {showDot && (
        <div
          className={joinClassNames(
            "rounded-full",
            pulsing && "animate-pulse",
            innerClassName || "w-1 h-1",
          )}
          style={dotStyle}
        />
      )}
    </div>
  );
}

interface UiPulseLabelProps {
  children: ReactNode;
  tone?: UiTone;
  className?: string;
}

export function UiPulseLabel({ children, tone = "info", className }: UiPulseLabelProps) {
  const toneConfig = resolveUiToneConfig(tone);
  return (
    <span
      className={joinClassNames("animate-pulse", toneConfig.textClass, className)}
      style={{
        textShadow: `0 0 12px color-mix(in srgb, var(${toneConfig.dotVar}) 40%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}
