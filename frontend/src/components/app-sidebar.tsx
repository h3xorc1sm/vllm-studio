// CRITICAL
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import api from "@/lib/api";
import { useAppStore } from "@/store";
import { ChatSessionsSection } from "./app-sidebar/chat-sessions-section";
import { MobileHeaderStatus } from "./app-sidebar/mobile-header-status";
import { navItems } from "./app-sidebar/nav-items";
import { SidebarStatus } from "./app-sidebar/sidebar-status";

interface AppSidebarProps {
  children: React.ReactNode;
}

export function AppSidebar({ children }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Store selectors — no local state
  const { collapsed, mobileOpen } = useAppStore(useShallow((s) => s.sidebar));
  const isMobile = useAppStore((s) => s.isMobile);
  const chatSessions = useAppStore((s) => s.sessions);
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const setSidebarMobileOpen = useAppStore((s) => s.setSidebarMobileOpen);
  const toggleSidebarCollapsed = useAppStore((s) => s.toggleSidebarCollapsed);
  const updateSessions = useAppStore((s) => s.updateSessions);
  const setCurrentSessionId = useAppStore((s) => s.setCurrentSessionId);
  const setCurrentSessionTitle = useAppStore((s) => s.setCurrentSessionTitle);

  // Derived — no useState needed
  const chatHistoryOpen = pathname === "/chat";

  const toggleCollapsed = useCallback(() => {
    toggleSidebarCollapsed();
  }, [toggleSidebarCollapsed]);

  const createNewChat = useCallback(() => {
    setSidebarMobileOpen(false);
    router.push("/chat?new=1");
  }, [setSidebarMobileOpen, router]);

  const handleDeleteSession = useCallback(
    async (sessionId: string, displayTitle: string) => {
      const label = displayTitle?.trim() || "this chat";
      if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;

      try {
        await api.deleteChatSession(sessionId);
        updateSessions((prev) => prev.filter((session) => session.id !== sessionId));

        if (sessionId === currentSessionId) {
          setCurrentSessionId(null);
          setCurrentSessionTitle("New Chat");
          if (pathname === "/chat") {
            router.push("/chat?new=1");
          }
        }
      } catch (err) {
        console.error("Failed to delete chat session:", err);
      }
    },
    [
      currentSessionId,
      pathname,
      router,
      setCurrentSessionId,
      setCurrentSessionTitle,
      updateSessions,
    ],
  );

  if (pathname.startsWith("/setup")) {
    return <div className="h-full w-full">{children}</div>;
  }

  return (
    <div className="flex h-full min-h-full overflow-hidden">
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 animate-fade-in"
          onClick={() => setSidebarMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${isMobile ? "fixed left-0 top-0 bottom-0 z-50" : "relative"}
          ${isMobile && !mobileOpen ? "-translate-x-full" : "translate-x-0"}
          ${collapsed && !isMobile ? "w-16" : "w-56"}
          shrink-0 bg-(--bg)/95 backdrop-blur-xl border-r border-(--border)
          flex flex-col transition-all duration-200 ease-out
        `}
        style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
      >
        {/* Logo */}
        <div
          className={`flex items-center h-14 px-3 ${collapsed && !isMobile ? "justify-center" : "gap-3"}`}
        >
          <Image
            src="/mocks/logo-1.svg"
            alt="vLLM"
            width={28}
            height={28}
            className="rounded shrink-0"
          />
          {(!collapsed || isMobile) && (
            <span className="font-medium text-sm truncate">vLLM Studio</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => {
                    if (isMobile) setSidebarMobileOpen(false);
                  }}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-colors
                    ${
                      isActive
                        ? "bg-(--surface) text-(--fg)"
                        : "text-(--dim) hover:text-(--fg) hover:bg-(--fg)/[0.06]"
                    }
                    ${collapsed && !isMobile ? "justify-center" : ""}
                  `}
                  title={collapsed && !isMobile ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                  {(!collapsed || isMobile) && (
                    <span className="text-sm">{item.label}</span>
                  )}
                </Link>
              </div>
            );
          })}

          {/* Chat sessions section (after nav items) */}
          {(!collapsed || isMobile) && (
            <div className="mt-3 pt-2">
              <ChatSessionsSection
                sessions={chatSessions}
                open={chatHistoryOpen}
                isMobile={isMobile}
                onCloseMobile={() => setSidebarMobileOpen(false)}
                onNewChat={createNewChat}
                onDeleteSession={handleDeleteSession}
              />
            </div>
          )}
        </nav>

        {/* Status */}
        <div
          className={`px-3 py-3 ${collapsed && !isMobile ? "flex justify-center" : ""}`}
        >
          <SidebarStatus collapsed={collapsed} isMobile={isMobile} />
        </div>

        {/* Collapse toggle - desktop only */}
        {!isMobile && (
          <button
            onClick={toggleCollapsed}
            className="absolute -right-3 top-20 w-6 h-6 bg-(--surface) border border-(--border) rounded-full flex items-center justify-center hover:bg-(--fg)/10 transition-colors shadow-lg shadow-black/40"
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5 text-(--dim)" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5 text-(--dim)" />
            )}
          </button>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden bg-background">
        {/* Mobile header */}
        {isMobile && pathname !== "/chat" && (
          <div
            className="sticky top-0 z-30 bg-(--surface) border-b border-(--border) px-3 py-2 flex items-center gap-2"
            style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top, 0))" }}
          >
            <button
              onClick={() => setSidebarMobileOpen(true)}
              className="p-1 -ml-1 rounded hover:bg-(--accent)"
            >
              <Image
                src="/mocks/logo-1.svg"
                alt="vLLM"
                width={20}
                height={20}
                className="rounded"
              />
            </button>
            <span className="font-medium text-xs">
              {navItems.find((item) => item.href === pathname)?.label || "vLLM Studio"}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <MobileHeaderStatus />
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
