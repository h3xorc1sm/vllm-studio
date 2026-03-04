// CRITICAL
"use client";

import {
  Paperclip,
  Image as ImageIcon,
  Mic,
  MicOff,
  Square,
  Globe,
  Code,
  Brain,
  SlidersHorizontal,
  Clock,
  Loader2,
  Plus,
  ArrowUp,
  Volume2,
  VolumeX,
  Phone,
  PhoneOff,
} from "lucide-react";
import { ToolDropdown, DropdownItem } from "../tool-dropdown";
import { buildDisplayModelLabel, type ModelOption } from "../../../types";

type Props = {
  isLoading?: boolean;
  elapsedSeconds?: number;
  thinkingSnippet?: string;
  isRecording: boolean;
  isTranscribing: boolean;
  attachmentsCount: number;
  disabled?: boolean;
  canSend: boolean;
  hasSystemPrompt?: boolean;
  toolsEnabled?: boolean;
  artifactsEnabled?: boolean;
  deepResearchEnabled?: boolean;
  isTTSEnabled?: boolean;
  availableModels?: ModelOption[];
  selectedModel?: string;
  onModelChange?: (modelId: string) => void;
  onOpenChatSettings?: () => void;
  onToolsToggle?: () => void;
  onArtifactsToggle?: () => void;
  onDeepResearchToggle?: () => void;
  onTTSToggle?: () => void;
  onAttachFile?: () => void;
  onAttachImage?: () => void;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onStop?: () => void;
  onSubmit?: () => void;
  callModeEnabled?: boolean;
  onCallModeToggle?: () => void;
};

export function ToolBeltToolbarDesktop({
  isLoading,
  elapsedSeconds,
  isRecording,
  isTranscribing,
  attachmentsCount,
  disabled,
  canSend,
  hasSystemPrompt,
  toolsEnabled,
  artifactsEnabled,
  deepResearchEnabled,
  isTTSEnabled,
  availableModels = [],
  selectedModel,
  onModelChange,
  onOpenChatSettings,
  onToolsToggle,
  onArtifactsToggle,
  onDeepResearchToggle,
  onTTSToggle,
  onAttachFile,
  onAttachImage,
  onStartRecording,
  onStopRecording,
  onStop,
  onSubmit,
  callModeEnabled,
  onCallModeToggle,
}: Props) {
  const hasActiveFeatures = Boolean(toolsEnabled || artifactsEnabled || deepResearchEnabled || hasSystemPrompt);

  return (
    <div className="hidden md:flex items-center justify-between">
      <div className="flex items-center gap-1 min-w-0">
        {/* Timer during loading */}
        {isLoading && elapsedSeconds !== undefined && elapsedSeconds >= 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg min-w-0">
            <Clock className="h-3 w-3 text-(--fg)/40 animate-pulse shrink-0" />
            <span className="text-xs font-mono text-(--fg)/40 shrink-0">
              {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, "0")}
            </span>
          </div>
        )}

        {/* Unified + dropdown: attachments, voice, tools, settings */}
        <ToolDropdown
          icon={Plus}
          label="Add"
          isActive={hasActiveFeatures || attachmentsCount > 0}
          disabled={disabled}
        >
          <DropdownItem
            icon={Paperclip}
            label="Attach file"
            onClick={onAttachFile}
            disabled={disabled}
            closeOnClick
          />
          <DropdownItem
            icon={ImageIcon}
            label="Attach image"
            onClick={onAttachImage}
            disabled={disabled}
            closeOnClick
          />

          <div className="my-1 mx-2 h-px bg-(--border)" />

          <DropdownItem
            icon={Globe}
            label="Web search & tools"
            isActive={toolsEnabled}
            onClick={onToolsToggle}
            disabled={disabled}
          />
          {onArtifactsToggle && (
            <DropdownItem
              icon={Code}
              label="Code preview"
              isActive={artifactsEnabled}
              onClick={onArtifactsToggle}
              disabled={disabled}
            />
          )}
          {onDeepResearchToggle && (
            <DropdownItem
              icon={Brain}
              label="Deep Research"
              isActive={deepResearchEnabled}
              onClick={onDeepResearchToggle}
              disabled={disabled}
            />
          )}

          <div className="my-1 mx-2 h-px bg-(--border)" />

          {onOpenChatSettings && (
            <DropdownItem
              icon={SlidersHorizontal}
              label={hasSystemPrompt ? "System prompt (active)" : "System prompt"}
              isActive={hasSystemPrompt}
              onClick={onOpenChatSettings}
              disabled={disabled}
            />
          )}
          {onTTSToggle && (
            <DropdownItem
              icon={isTTSEnabled ? Volume2 : VolumeX}
              label={isTTSEnabled ? "TTS enabled" : "Text-to-speech"}
              isActive={isTTSEnabled}
              onClick={onTTSToggle}
              disabled={disabled}
            />
          )}
          {onCallModeToggle && (
            <DropdownItem
              icon={callModeEnabled ? PhoneOff : Phone}
              label={callModeEnabled ? "End call mode" : "Call mode"}
              isActive={callModeEnabled}
              onClick={onCallModeToggle}
              disabled={disabled || isTranscribing}
            />
          )}
        </ToolDropdown>

        {/* Mic button stays visible — it's a frequently used action */}
        <button
          onClick={isRecording ? onStopRecording : onStartRecording}
          disabled={disabled || isTranscribing}
          className={`flex items-center justify-center p-2 rounded-lg transition-all:ease-in:200ms disabled:opacity-50 ${
            isRecording
              ? "bg-(--err)/15 text-(--err)"
              : isTranscribing
                ? "bg-(--hl1)/15 text-(--hl1)"
                : "hover:bg-(--fg)/5 text-(--dim)"
          }`}
          title={
            isTranscribing ? "Transcribing..." : isRecording ? "Stop recording" : "Voice input"
          }
        >
          {isTranscribing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isRecording ? (
            <MicOff className="h-3.5 w-3.5" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <div className="flex items-center gap-2">
        {availableModels.length > 0 && onModelChange && (
          <select
            value={selectedModel || ""}
            onChange={(e) => onModelChange(e.target.value)}
            disabled={disabled || isLoading}
            className="max-w-[180px] px-2 py-1 font-sans text-xs bg-transparent border border-(--border) rounded-lg text-(--dim) focus:outline-none focus:border-(--accent)/40 disabled:opacity-50 truncate appearance-none cursor-pointer hover:text-(--fg) hover:border-(--fg)/20 transition-colors:ease-in:200ms"
            title={selectedModel || "Select model"}
          >
            {(() => {
              const grouped = new Map<string, typeof availableModels>();
              for (const model of availableModels) {
                const group = model.provider || "local";
                if (!grouped.has(group)) grouped.set(group, []);
                grouped.get(group)!.push(model);
              }
              if (grouped.size <= 1) {
                return availableModels.map((model, idx) => (
                  <option key={`${model.id}-${idx}`} value={model.id}>
                    {buildDisplayModelLabel(model.id, model.provider)}
                  </option>
                ));
              }
              return Array.from(grouped.entries()).map(([group, models]) => (
                <optgroup key={group} label={group}>
                  {models.map((model, idx) => (
                    <option key={`${model.id}-${idx}`} value={model.id}>
                      {buildDisplayModelLabel(model.id, model.provider)}
                    </option>
                  ))}
                </optgroup>
              ));
            })()}
          </select>
        )}

        {isLoading ? (
          <button
            onClick={onStop}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-(--err)/15 text-(--err) hover:bg-(--err)/25 transition-colors:ease-in:200ms shrink-0"
            title="Stop"
          >
            <Square className="h-3 w-3 fill-current" />
          </button>
        ) : (
          <button
            onClick={onSubmit}
            disabled={!canSend}
            className={`h-8 w-8 flex items-center justify-center rounded-full transition-colors:ease-in:200ms shrink-0 ${
              canSend
                ? "bg-(--fg) text-(--bg) hover:bg-(--fg)/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg)"
                : "bg-(--fg)/10 text-(--dim)/40 cursor-not-allowed"
            }`}
            title="Send"
          >
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
