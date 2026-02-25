import { describe, expect, it } from "vitest";
import { resolveNewChatResetGate } from "./chat-session-bootstrap";

describe("resolveNewChatResetGate", () => {
  it("runs reset exactly once while ?new=1 stays active", () => {
    const first = resolveNewChatResetGate({
      newChatFromUrl: true,
      hasHandledNewChatReset: false,
    });
    expect(first.shouldReset).toBe(true);
    expect(first.hasHandledNewChatReset).toBe(true);

    const second = resolveNewChatResetGate({
      newChatFromUrl: true,
      hasHandledNewChatReset: first.hasHandledNewChatReset,
    });
    expect(second.shouldReset).toBe(false);
    expect(second.hasHandledNewChatReset).toBe(true);
  });

  it("re-arms once URL leaves new-chat mode", () => {
    const cleared = resolveNewChatResetGate({
      newChatFromUrl: false,
      hasHandledNewChatReset: true,
    });
    expect(cleared.shouldReset).toBe(false);
    expect(cleared.hasHandledNewChatReset).toBe(false);

    const nextNew = resolveNewChatResetGate({
      newChatFromUrl: true,
      hasHandledNewChatReset: cleared.hasHandledNewChatReset,
    });
    expect(nextNew.shouldReset).toBe(true);
    expect(nextNew.hasHandledNewChatReset).toBe(true);
  });
});
