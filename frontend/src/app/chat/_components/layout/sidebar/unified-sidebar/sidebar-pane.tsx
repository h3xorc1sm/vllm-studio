// CRITICAL
"use client";

import { GripVertical, PanelRightClose } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildSidebarPanelInstances, resolveSidebarActiveTab, resolveSidebarPanelContent } from "./panel-registry";
import type { SidebarPaneProps, SidebarTab } from "./types";
import { TabButton } from "./tab-button";

const MIN_WIDTH = 280;
const DEFAULT_MAX_WIDTH = 1000;
const DEFAULT_WIDTH = 400;

export function SidebarPane({
  isOpen,
  onToggle,
  activeTab,
  onSetActiveTab,
  panelContentMap,
  hasArtifacts,
  width: controlledWidth,
  onWidthChange,
}: SidebarPaneProps) {
  const [localWidth, setLocalWidth] = useState(() => controlledWidth ?? DEFAULT_WIDTH);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const baseWidth = controlledWidth ?? localWidth;
  const displayWidth = dragWidth ?? baseWidth;

  const widthRef = useRef<number>(displayWidth);
  useEffect(() => {
    widthRef.current = displayWidth;
  }, [displayWidth]);

  const commitWidth = useCallback(
    (nextWidth: number) => {
      widthRef.current = nextWidth;
      if (onWidthChange) onWidthChange(nextWidth);
      else setLocalWidth(nextWidth);
    },
    [onWidthChange],
  );

  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      widthRef.current = baseWidth;
      setDragWidth(baseWidth);
      resizeRef.current = { startX: e.clientX, startWidth: baseWidth };
    },
    [baseWidth],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      const maxWidth = Math.max(MIN_WIDTH, Math.floor(window.innerWidth * 0.9));
      if (widthRef.current > maxWidth) {
        if (isResizing) setDragWidth(maxWidth);
        commitWidth(maxWidth);
      }
    };
    const raf = window.requestAnimationFrame(handleResize);
    window.addEventListener("resize", handleResize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
    };
  }, [commitWidth, isResizing]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = resizeRef.current.startX - e.clientX;
      const maxWidth =
        typeof window !== "undefined"
          ? Math.max(MIN_WIDTH, Math.floor(window.innerWidth * 0.9))
          : DEFAULT_MAX_WIDTH;
      const nextWidth = Math.min(maxWidth, Math.max(MIN_WIDTH, resizeRef.current.startWidth + delta));
      widthRef.current = nextWidth;
      setDragWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setDragWidth(null);
      resizeRef.current = null;
      commitWidth(widthRef.current);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [commitWidth, isResizing]);

  const panels = useMemo(
    () => buildSidebarPanelInstances("desktop", hasArtifacts, panelContentMap),
    [hasArtifacts, panelContentMap],
  );
  const resolvedActiveTab = useMemo(() => resolveSidebarActiveTab(activeTab, panels), [activeTab, panels]);

  const activeContent = useMemo(
    () => resolveSidebarPanelContent(resolvedActiveTab, panels),
    [panels, resolvedActiveTab],
  );

  const setActiveTab = useCallback(
    (tab: SidebarTab) => {
      if (tab !== resolvedActiveTab) onSetActiveTab(tab);
    },
    [onSetActiveTab, resolvedActiveTab],
  );

  if (!isOpen) return null;

  return (
    <>
      <div
        className="hidden md:flex shrink-0 flex-col h-full bg-(--bg) relative border-l border-(--border)"
        style={{
          width: `${displayWidth}px`,
          backgroundImage: "linear-gradient(180deg, var(--surface), var(--bg))",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ boxShadow: "inset 1px 0 0 rgba(255,255,255,0.05)" }}
        />

        <div
          className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 group flex items-center justify-center ${
            isResizing ? "bg-(--hl2)/30" : "hover:bg-(--hl2)/20"
          }`}
          onMouseDown={handleResizeStart}
        >
          <div
            className={`absolute left-0 w-4 h-12 flex items-center justify-center rounded-r transition-opacity ${
              isResizing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <GripVertical className="h-4 w-4 text-(--hl2)/70" />
          </div>
        </div>

        <div className="relative flex items-center justify-between px-2 border-b border-(--border)">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
            {panels.map((panel) => (
              <TabButton
                key={panel.id}
                active={resolvedActiveTab === panel.id}
                onClick={() => setActiveTab(panel.id)}
                label={panel.label}
                accent={panel.accent}
              />
            ))}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg hover:bg-(--fg)/[0.06] text-(--dim) transition-colors"
              title="Close sidebar"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">{activeContent}</div>
      </div>

      {isResizing && (
        <style jsx global>{`
          body {
            cursor: col-resize !important;
            user-select: none !important;
          }
        `}</style>
      )}
    </>
  );
}
