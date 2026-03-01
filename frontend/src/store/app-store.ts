import { create, type StateCreator } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { createChatSlice, type ChatSlice } from "./chat-slice";
import { createThemeSlice, type ThemeSlice } from "./theme-slice";
import api from "@/lib/api";

export type AppStore = ChatSlice &
  ThemeSlice & {
    _hasHydrated: boolean;
    setHasHydrated: (hasHydrated: boolean) => void;
  };

const createAppStore: StateCreator<AppStore, [], [], AppStore> = (set, ...args) => ({
  ...createChatSlice(set, ...args),
  ...createThemeSlice(set, ...args),
  _hasHydrated: false,
  setHasHydrated: (hasHydrated) => set({ _hasHydrated: hasHydrated }),
});

const storage = createJSONStorage(() =>
  typeof window !== "undefined" ? localStorage : (undefined as unknown as Storage),
);

export const useAppStore = create<AppStore>()(
  devtools(
    persist(createAppStore, {
      name: "vllm-studio-chat-state",
      storage,
      skipHydration: true,
      partialize: (state) => ({
        selectedModel: state.selectedModel,
        systemPrompt: state.systemPrompt,
        customChatModels: state.customChatModels,
        toolsEnabled: state.toolsEnabled,
        artifactsEnabled: state.artifactsEnabled,
        deepResearch: state.deepResearch,
        themeId: state.themeId,
        fontFamilyId: state.fontFamilyId,
        fontSizeId: state.fontSizeId,
        sidebarCollapsed: state.sidebar.collapsed,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<AppStore>),
        // Restore nested sidebar.collapsed from the flat persisted key
        sidebar: {
          ...current.sidebar,
          collapsed: (persisted as Record<string, unknown>)?.sidebarCollapsed === true,
        },
      }),
      onRehydrateStorage: () => (state) => {
        state?.setAgentMode(true);
        state?.setHasHydrated(true);
        if (state?.themeId) {
          state.setThemeId(state.themeId);
        }
        if (state?.fontFamilyId) {
          state.setFontFamilyId(state.fontFamilyId);
        }
        if (state?.fontSizeId) {
          state.setFontSizeId(state.fontSizeId);
        }
        // Fetch chat sessions immediately on hydration
        api
          .getChatSessions()
          .then((result) => {
            useAppStore.getState().setSessions(result.sessions || []);
          })
          .catch(() => {
            useAppStore.getState().setSessions([]);
          })
          .finally(() => {
            useAppStore.getState().setSessionsLoading(false);
          });
      },
    }),
    {
      name: "vllm-studio",
    },
  ),
);

// Trigger hydration at module load (guarded for SSR).
if (typeof window !== "undefined") {
  void useAppStore.persist.rehydrate();
}
