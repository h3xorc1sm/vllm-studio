// CRITICAL
"use client";

import { useMemo, useState } from "react";
import { Settings, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { DeepResearchConfig } from "@/lib/types";
import type { ModelOption } from "../../types";
import { parseChatModelId } from "../../types";
import { UiModal, UiModalHeader } from "@/components/ui-kit";

interface ChatSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
  selectedModel: string;
  onSelectedModelChange: (model: string) => void;
  availableModels: ModelOption[];
  customChatModels: string[];
  onAddCustomChatModel: (model: string) => void;
  onRemoveCustomChatModel: (model: string) => void;
  deepResearch: DeepResearchConfig;
  onDeepResearchChange: (config: DeepResearchConfig) => void;
}

export function ChatSettingsModal({
  isOpen,
  onClose,
  systemPrompt,
  onSystemPromptChange,
  selectedModel,
  onSelectedModelChange,
  availableModels,
  customChatModels,
  onAddCustomChatModel,
  onRemoveCustomChatModel,
  deepResearch,
  onDeepResearchChange,
}: ChatSettingsModalProps) {
  const [newCustomModel, setNewCustomModel] = useState("");
  const [customModelError, setCustomModelError] = useState("");

  const normalizedCustomModels = useMemo(
    () =>
      Array.from(
        new Set(customChatModels.map((model) => model.trim()).filter((model) => model.length > 0)),
      ),
    [customChatModels],
  );

  const isDuplicate = normalizedCustomModels.includes(newCustomModel.trim());
  const availableByDisplayId = useMemo(
    () =>
      new Set(
        availableModels.flatMap((model) => {
          const parsed = parseChatModelId(model.id);
          return [model.id, parsed.id];
        }),
      ),
    [availableModels],
  );

  const handleAddCustomModel = () => {
    const selected = newCustomModel.trim();
    if (!selected) {
      setCustomModelError("Model id is required.");
      return;
    }
    if (isDuplicate || availableByDisplayId.has(selected)) {
      setCustomModelError("This model is already in your list.");
      return;
    }
    onAddCustomChatModel(selected);
    setNewCustomModel("");
    setCustomModelError("");
  };

  const handleCustomModelKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddCustomModel();
    }
  };

  if (!isOpen) return null;

  return (
    <UiModal isOpen={isOpen} onClose={onClose} className="max-w-lg mx-4">
      <UiModalHeader
        title="Chat Settings"
        icon={<Settings className="h-5 w-5 text-(--dim)" />}
        onClose={onClose}
        closeIcon={<X className="h-5 w-5 text-(--dim)" />}
      />
      <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
        <div>
          <label className="block text-sm font-medium text-(--dim) mb-2">Model</label>
          <select
            value={selectedModel}
            onChange={(e) => onSelectedModelChange(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-(--border) rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-(--hl1)/50"
          >
            <option value="">Select a model</option>
            {(() => {
              const grouped = new Map<string, ModelOption[]>();
              for (const model of availableModels) {
                const group = model.provider || "local";
                if (!grouped.has(group)) grouped.set(group, []);
                grouped.get(group)!.push(model);
              }
              if (grouped.size <= 1) {
                return availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name ?? model.id}
                  </option>
                ));
              }
              return Array.from(grouped.entries()).map(([group, models]) => (
                <optgroup key={group} label={group}>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name ?? model.id}
                    </option>
                  ))}
                </optgroup>
              ));
            })()}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-(--dim) mb-2">System Prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => onSystemPromptChange(e.target.value)}
            rows={4}
            placeholder="Enter a system prompt..."
            className="w-full px-3 py-2 bg-background border border-(--border) rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-(--hl1)/50"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={deepResearch.enabled}
              onChange={(e) => onDeepResearchChange({ ...deepResearch, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-(--border) bg-background"
            />
            <span className="text-sm font-medium text-(--dim)">Enable Deep Research</span>
          </label>
          <p className="text-xs text-(--dim) mt-1 ml-6">
            Uses web search to gather context before responding
          </p>
        </div>

        <div className="border-t border-(--border) pt-4">
          <label className="block text-sm font-medium text-(--dim) mb-2">Custom Models</label>
          <p className="text-xs text-(--dim) mb-3">
            Add custom OpenAI-compatible model IDs for the chat model selector (example:
            provider/model-name).
          </p>

          <div className="flex gap-2">
            <input
              value={newCustomModel}
              onChange={(event) => {
                setNewCustomModel(event.target.value);
                setCustomModelError("");
              }}
              onKeyDown={handleCustomModelKeyDown}
              placeholder="provider/model"
              className="w-full px-3 py-2 bg-background border border-(--border) rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-(--hl1)/50"
            />
            <button
              type="button"
              onClick={handleAddCustomModel}
              className="px-3 py-2 rounded-lg border border-(--border) bg-(--surface) hover:bg-(--border) text-sm whitespace-nowrap"
            >
              Add
            </button>
          </div>
          {customModelError && <p className="text-xs text-red-400 mt-2">{customModelError}</p>}

          <ul className="mt-3 space-y-2 max-h-40 overflow-y-auto pr-1">
            {normalizedCustomModels.length === 0 ? (
              <li className="text-xs text-(--dim)">No custom models configured.</li>
            ) : (
              normalizedCustomModels.map((model) => (
                <li
                  key={model}
                  className="text-xs text-(--fg) flex items-center justify-between gap-2 px-2 py-1 border border-(--border) rounded-md bg-(--border)"
                >
                  <span className="truncate">{model}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveCustomChatModel(model)}
                    className="text-(--err) hover:text-red-300 text-xs"
                    title={`Remove ${model}`}
                  >
                    Remove
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </UiModal>
  );
}
