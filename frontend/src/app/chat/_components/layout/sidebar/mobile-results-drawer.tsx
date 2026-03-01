// CRITICAL
"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, PanelRightClose } from "lucide-react";
import { buildSidebarPanelInstances, resolveSidebarActiveTab, resolveSidebarPanelContent } from "./unified-sidebar/panel-registry";
import type { SidebarPanelContentMap, SidebarTab } from "./unified-sidebar/types";

interface MobileResultsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: SidebarTab;
  onSetActiveTab: (tab: SidebarTab) => void;
  hasArtifacts: boolean;
  panelContentMap: SidebarPanelContentMap;
}

const MIN_DRAWER_HEIGHT = 220;
const DEFAULT_DRAWER_RATIO = 0.72;
const MAX_DRAWER_RATIO = 0.92;
const FALLBACK_DRAWER_HEIGHT = 420;

export const MobileResultsDrawer = memo(function MobileResultsDrawer({
  isOpen,
  onClose,
  activeTab,
  onSetActiveTab,
  hasArtifacts,
  panelContentMap,
}: MobileResultsDrawerProps) {
  const panels = useMemo(
    () => buildSidebarPanelInstances("mobile", hasArtifacts, panelContentMap),
    [hasArtifacts, panelContentMap],
  );
  const resolvedActiveTab = useMemo(() => resolveSidebarActiveTab(activeTab, panels), [activeTab, panels]);

  const handleSelect = useCallback(
    (tab: SidebarTab) => {
      if (tab !== resolvedActiveTab) onSetActiveTab(tab);
    },
    [onSetActiveTab, resolvedActiveTab],
  );

  const content = useMemo(
    () => resolveSidebarPanelContent(resolvedActiveTab, panels),
    [panels, resolvedActiveTab],
  );

  const computeMaxHeight = useCallback(() => {
    if (typeof window === "undefined") return 0;
    return Math.floor(window.innerHeight * MAX_DRAWER_RATIO);
  }, []);

  const computeDefaultHeight = useCallback(() => {
    if (typeof window === "undefined") return FALLBACK_DRAWER_HEIGHT;
    const ratioHeight = Math.floor(window.innerHeight * DEFAULT_DRAWER_RATIO);
    const maxHeight = computeMaxHeight();
    return Math.max(MIN_DRAWER_HEIGHT, Math.min(ratioHeight, maxHeight || ratioHeight));
  }, [computeMaxHeight]);

  const [drawerHeightPx, setDrawerHeightPx] = useState<number>(() => {
    if (typeof window === "undefined") return FALLBACK_DRAWER_HEIGHT;
    const maxHeight = Math.floor(window.innerHeight * MAX_DRAWER_RATIO);
    const ratioHeight = Math.floor(window.innerHeight * DEFAULT_DRAWER_RATIO);
    return Math.max(MIN_DRAWER_HEIGHT, Math.min(ratioHeight, maxHeight || ratioHeight));
  });
  const [isDragging, setIsDragging] = useState(false);

  const heightRef = useRef<number>(drawerHeightPx);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const animationRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const isOpenRef = useRef(isOpen);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    heightRef.current = drawerHeightPx;
  }, [drawerHeightPx]);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onResize = () => {
      const maxHeight = computeMaxHeight();
      if (maxHeight === 0) return;
      setDrawerHeightPx((current) => {
        const clamped = Math.min(Math.max(current, MIN_DRAWER_HEIGHT), maxHeight);
        heightRef.current = clamped;
        return clamped;
      });
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isDraggingRef.current || !dragRef.current) return;

      const maxHeight = computeMaxHeight();
      const deltaY = dragRef.current.startY - event.clientY;
      const nextHeight = dragRef.current.startHeight + deltaY;
      const constrainedHeight =
        maxHeight === 0 ? nextHeight : Math.min(Math.max(nextHeight, MIN_DRAWER_HEIGHT), maxHeight);

      if (animationRef.current != null) {
        window.cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = window.requestAnimationFrame(() => {
        heightRef.current = constrainedHeight;
        setDrawerHeightPx(constrainedHeight);
      });
    };

    const clearDragState = () => {
      if (animationRef.current != null) {
        window.cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      dragRef.current = null;
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
      }
    };

    const onPointerUp = () => {
      clearDragState();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isOpenRef.current) return;
      if (event.key === "Escape") onCloseRef.current();
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
      clearDragState();
    };
  }, [computeMaxHeight]);

  const handleDragStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      dragRef.current = {
        startY: event.clientY,
        startHeight: heightRef.current || computeDefaultHeight(),
      };
      isDraggingRef.current = true;
      setIsDragging(true);
    },
    [computeDefaultHeight],
  );

  const drawerHeight = drawerHeightPx <= 0 ? computeDefaultHeight() : drawerHeightPx;

  return (
    <>
      <div className="md:hidden">
        <div
          className={`fixed inset-0 z-40 bg-black/55 transition-opacity duration-200 ${
            isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={onClose}
        />

        <div
          className={`fixed left-0 right-0 bottom-0 z-50 transition-transform duration-250 ease-out ${
            isOpen ? "translate-y-0" : "translate-y-[calc(100%+16px)]"
          }`}
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0)", height: `${drawerHeight}px` }}
        >
          <div
            className="mx-2 mb-2 h-full rounded-2xl bg-(--bg)/95 backdrop-blur-xl overflow-hidden flex flex-col min-h-0 border border-(--border)"
            style={{ boxShadow: "0 -12px 40px rgba(0,0,0,0.5)" }}
          >
            <div
              className="px-3 pt-2 pb-2 flex items-center gap-2 cursor-row-resize select-none touch-none"
              onPointerDown={handleDragStart}
            >
              <div className="mx-auto h-1 w-10 rounded-full bg-(--fg)/20" />
              <GripVertical className="h-3 w-3 text-(--dim) shrink-0" />
              <button
                onClick={onClose}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                className="ml-auto -mr-1 p-2 rounded-lg hover:bg-(--fg)/[0.06] text-(--dim) transition-colors"
                title="Close"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
            </div>

            <div className="px-2 flex items-center gap-0 overflow-x-auto border-b border-(--border)">
              {panels.map((panel) => {
                const isActive = resolvedActiveTab === panel.id;
                return (
                  <button
                    key={panel.id}
                    onClick={() => handleSelect(panel.id)}
                    className={`px-2.5 py-2 border-b-2 text-[11px] font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? panel.accent
                          ? "text-(--hl2) border-(--hl2)"
                          : "text-(--fg) border-(--fg)/70"
                        : panel.accent
                          ? "text-(--hl2)/60 border-transparent hover:text-(--hl2)"
                          : "text-(--dim) border-transparent hover:text-(--fg)"
                    }`}
                  >
                    {panel.label}
                  </button>
                );
              })}
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">{content}</div>
          </div>
        </div>
      </div>

      {isDragging && (
        <style jsx global>{`
          body {
            cursor: row-resize !important;
            user-select: none !important;
          }
        `}</style>
      )}
    </>
  );
});
