// CRITICAL
import type { ChatState } from "../chat-slice-types";
import { DEFAULT_DEEP_RESEARCH } from "../chat-slice-defaults";

export const initialChatState: ChatState = {
  // Sessions
  sessions: [],
  currentSessionId: null,
  currentSessionTitle: "New Chat",
  sessionsLoading: true,

  // Input
  input: "",
  error: null,

  // Streaming
  streamingStartTime: null,
  elapsedSeconds: 0,
  lastRunDurationSeconds: null,
  runDurationsByRunId: {},
  queuedContext: "",

  // Model
  selectedModel: "",
  availableModels: [],
  customChatModels: [],

  // Layout
  isMobile: false,
  userScrolledUp: false,
  sidebar: { collapsed: false, mobileOpen: false },

  // Tooling
  toolsEnabled: false,
  artifactsEnabled: false,
  executingTools: new Set(),
  toolResultsMap: new Map(),

  // Settings
  systemPrompt: "",
  chatSettingsOpen: false,
  deepResearch: DEFAULT_DEEP_RESEARCH,

  // Usage & export
  sessionUsage: null,
  usageDetailsOpen: false,
  exportOpen: false,

  // Attachments & recording
  attachments: [],
  isRecording: false,
  isTranscribing: false,
  transcriptionError: null,
  recordingDuration: 0,
  isTTSEnabled: false,

  callModeEnabled: false,
  callModeSpeakingMessageId: null,

  // Message UI state
  copiedMessageId: null,
  messageInlineThinkingExpanded: {},
  messageInlineToolsExpanded: {},
  toolCallGroupsExpanded: {},

  // Artifacts
  activeArtifactId: null,
  artifactViewerState: {},

  // Code blocks & sandboxes
  codeBlockState: {},
  mermaidState: {},

  // Splash
  splashIsMobile: false,

  // Agent mode
  agentMode: true,
  agentPlan: null,
  agentFiles: [],
  agentFilesLoading: false,
  selectedAgentFilePath: null,
  selectedAgentFileContent: null,
  selectedAgentFileLoading: false,
  agentFileVersions: {},
  sidebarWidth: 400,
  resultsLastTab: null,
  mobilePlanChipHidden: false,

  // Toasts (ephemeral UI; not persisted)
  toasts: [],
};
