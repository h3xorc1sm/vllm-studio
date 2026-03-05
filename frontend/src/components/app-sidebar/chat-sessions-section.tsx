// CRITICAL
"use client";

import { type MouseEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2, ChevronRight } from "lucide-react";
import type { ChatSession } from "@/lib/types";

export function ChatSessionsSection({
  sessions,
  currentSessionId,
  isMobile,
  onCloseMobile,
  onDeleteSession,
}: {
  sessions: ChatSession[];
  currentSessionId: string | null;
  open: boolean;
  isMobile: boolean;
  onCloseMobile: () => void;
  onDeleteSession: (sessionId: string, displayTitle: string) => void;
}) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const sessionRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions
      .map((session) => {
        let displayTitle = session.title;
        if (!displayTitle || displayTitle === "New Chat") {
          if (session.first_user_message) {
            const words = session.first_user_message.trim().split(/\s+/).slice(0, 6);
            displayTitle = words.join(" ") + (words.length >= 6 ? "..." : "");
          } else {
            displayTitle = "New Chat";
          }
        }
        return { session, displayTitle };
      })
      .filter((row) => (q ? row.displayTitle.toLowerCase().includes(q) : true));
  }, [query, sessions]);

  const handleDelete = (
    event: MouseEvent<HTMLButtonElement>,
    sessionId: string,
    displayTitle: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    onDeleteSession(sessionId, displayTitle);
  };

  if (sessions.length === 0) {
    return (
      <div className="px-1">
        <div className="px-3 py-4 text-center">
          <p className="text-sm text-(--dim)">No recent chats</p>
          <p className="text-xs text-(--dim) mt-1 opacity-70">Start a new conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-1">
      {/* Section Header */}
      <div className="flex items-center justify-between px-3 mb-2">
        <span className="text-xs font-medium text-(--dim) uppercase tracking-wide">Recent Chats</span>
      </div>

      {/* Search Bar */}
      <div className="px-3 mb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-(--dim)" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search recent chats..."
            className="w-full h-8 pl-8 pr-3 text-sm rounded-lg border border-(--border) bg-(--surface)/50 text-(--fg) placeholder:text-(--dim)/60 focus:outline-none focus:ring-1 focus:ring-(--hl1)/40 focus:border-(--hl1)/40 transition-all"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="space-y-0.5 max-h-64 overflow-y-auto scrollbar-thin">
        {sessionRows.length === 0 && (
          <div className="px-3 py-3 text-sm text-(--dim) text-center">No matching chats</div>
        )}
        {sessionRows.map(({ session, displayTitle }) => {
          const isActive = session.id === currentSessionId;
          return (
            <div key={session.id} className="group flex items-center gap-1 px-3">
              <button
                onClick={() => {
                  if (!isActive) {
                    router.replace(`/chat?session=${session.id}`);
                  }
                  if (isMobile) onCloseMobile();
                }}
                className={`flex-1 min-w-0 px-3 py-2 text-sm rounded-lg transition-all truncate text-left ${
                  isActive
                    ? "text-(--fg) bg-(--surface) font-medium"
                    : "text-(--dim) hover:text-(--fg) hover:bg-(--fg)/[0.06]"
                }`}
                title={displayTitle}
              >
                {displayTitle}
              </button>
              <button
                onClick={(event) => handleDelete(event, session.id, displayTitle)}
                className="opacity-60 md:opacity-0 md:group-hover:opacity-100 p-2 rounded-lg hover:bg-(--accent) transition-all shrink-0"
                title={`Delete ${displayTitle}`}
              >
                <Trash2 className="h-3.5 w-3.5 text-(--dim)" />
              </button>
            </div>
          );
        })}
      </div>

      {/* View All Link */}
      {sessions.length > 0 && (
        <div className="px-3 mt-2">
          <button
            onClick={() => router.push("/chat/history")}
            className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs text-(--dim) hover:text-(--fg) rounded-lg hover:bg-(--fg)/[0.06] transition-all group"
          >
            <span>View all chats</span>
            <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}
    </div>
  );
}
