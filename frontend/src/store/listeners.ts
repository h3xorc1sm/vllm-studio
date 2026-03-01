/**
 * Module-level window listeners that sync browser events into the app store.
 * Import this file once (e.g. from store/index.ts) to activate.
 */
import { useAppStore } from "./app-store";

if (typeof window !== "undefined") {
  // --- Resize → isMobile + sidebar.collapsed ---
  const onResize = () => {
    const mobile = window.innerWidth < 768;
    const state = useAppStore.getState();
    if (state.isMobile !== mobile) {
      useAppStore.setState({ isMobile: mobile });
    }
    if (mobile && !state.sidebar.collapsed) {
      state.setSidebarCollapsed(true);
    }
  };
  window.addEventListener("resize", onResize);
  onResize();

  // --- Custom event: vllm:toggle-sidebar ---
  window.addEventListener("vllm:toggle-sidebar", ((event: CustomEvent<{ open?: boolean }>) => {
    const requested = event?.detail?.open;
    if (typeof requested === "boolean") {
      useAppStore.getState().setSidebarMobileOpen(requested);
    } else {
      useAppStore.getState().toggleSidebarMobileOpen();
    }
  }) as EventListener);
}
