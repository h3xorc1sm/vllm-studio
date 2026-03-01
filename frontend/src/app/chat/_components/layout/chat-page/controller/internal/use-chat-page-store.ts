// CRITICAL
"use client";

import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store";

export function useChatPageStore() {
  const store = useAppStore(
    useShallow((state) => ({
      setInput: state.setInput,
      selectedModel: state.selectedModel,
      setSelectedModel: state.setSelectedModel,
      systemPrompt: state.systemPrompt,
      setSystemPrompt: state.setSystemPrompt,
      toolsEnabled: state.toolsEnabled,
      setToolsEnabled: state.setToolsEnabled,
      artifactsEnabled: state.artifactsEnabled,
      setArtifactsEnabled: state.setArtifactsEnabled,
      activeArtifactId: state.activeArtifactId,
      setActiveArtifactId: state.setActiveArtifactId,
      deepResearch: state.deepResearch,
      setDeepResearch: state.setDeepResearch,
      setElapsedSeconds: state.setElapsedSeconds,
      streamingStartTime: state.streamingStartTime,
      setStreamingStartTime: state.setStreamingStartTime,

      settingsOpen: state.chatSettingsOpen,
      setSettingsOpen: state.setChatSettingsOpen,
      usageOpen: state.usageDetailsOpen,
      setUsageOpen: state.setUsageDetailsOpen,
      exportOpen: state.exportOpen,
      setExportOpen: state.setExportOpen,
      availableModels: state.availableModels,
      setAvailableModels: state.setAvailableModels,
      customChatModels: state.customChatModels,
      setCustomChatModels: state.setCustomChatModels,
      addCustomChatModel: state.addCustomChatModel,
      removeCustomChatModel: state.removeCustomChatModel,
      sessionUsage: state.sessionUsage,
      setExecutingTools: state.setExecutingTools,
      updateExecutingTools: state.updateExecutingTools,
      setToolResultsMap: state.setToolResultsMap,
      updateToolResultsMap: state.updateToolResultsMap,

      agentMode: state.agentMode,
      setAgentMode: state.setAgentMode,
      agentPlan: state.agentPlan,
      setAgentPlan: state.setAgentPlan,

      sidebarWidth: state.sidebarWidth,
      setSidebarWidth: state.setSidebarWidth,

      resultsLastTab: state.resultsLastTab,
      setResultsLastTab: state.setResultsLastTab,

      pushToast: state.pushToast,

      updateSessions: state.updateSessions,
    })),
  );

  return store;
}
