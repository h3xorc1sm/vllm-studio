import { describe, expect, it } from "vitest";
import { shouldAutoOpenActivityPanel } from "./chat-sidebar-controller";

describe("shouldAutoOpenActivityPanel", () => {
  it("does not auto-open without a session", () => {
    const value = shouldAutoOpenActivityPanel({
      hasActivity: true,
      hadActivity: false,
      autoOpenedActivity: false,
      sidebarOpen: false,
      currentSessionId: null,
      sessionFromUrl: null,
      isMobile: false,
    });
    expect(value).toBe(false);
  });

  it("auto-opens on first activity when a session exists", () => {
    const value = shouldAutoOpenActivityPanel({
      hasActivity: true,
      hadActivity: false,
      autoOpenedActivity: false,
      sidebarOpen: false,
      currentSessionId: "session-1",
      sessionFromUrl: "session-1",
      isMobile: false,
    });
    expect(value).toBe(true);
  });

  it("blocks auto-open in mobile viewports", () => {
    const value = shouldAutoOpenActivityPanel({
      hasActivity: true,
      hadActivity: false,
      autoOpenedActivity: false,
      sidebarOpen: false,
      currentSessionId: "session-1",
      sessionFromUrl: "session-1",
      isMobile: true,
    });
    expect(value).toBe(false);
  });

  it("does not auto-open when already opened for this activity wave", () => {
    const value = shouldAutoOpenActivityPanel({
      hasActivity: true,
      hadActivity: true,
      autoOpenedActivity: true,
      sidebarOpen: false,
      currentSessionId: "session-1",
      sessionFromUrl: "session-1",
      isMobile: false,
    });
    expect(value).toBe(false);
  });
});
