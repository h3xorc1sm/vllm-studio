"use client";

import { AlertTriangle, Loader2, Rocket } from "lucide-react";

export function StepLaunch({
  selectedModel,
  createdRecipeId,
  configuringRecipe,
  launchError,
  configureAndLaunch,
}: {
  selectedModel: string;
  createdRecipeId: string | null;
  configuringRecipe: boolean;
  launchError: string | null;
  configureAndLaunch: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-(--bg) border border-(--surface) rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Rocket className="h-5 w-5 text-(--hl1)" />
          <h2 className="text-lg font-medium">Configure and Launch</h2>
        </div>
        <p className="text-sm text-(--dim)">
          vLLM Studio will create a starter recipe for{" "}
          <span className="text-(--fg)">{selectedModel}</span>, keep the safe local defaults, and
          launch it immediately.
        </p>
        <div className="rounded-lg border border-(--surface) bg-(--surface)/40 p-4 text-sm text-(--dim)">
          <div>Backend: vLLM</div>
          <div>dtype: auto</div>
          <div>KV cache dtype: auto</div>
          <div>Tooling changes are left for the Hermes guide in Get Started.</div>
        </div>
        {createdRecipeId && (
          <div className="text-xs text-(--dim)">
            Starter recipe id: <span className="text-(--fg)">{createdRecipeId}</span>
          </div>
        )}
        {launchError && (
          <div className="flex items-start gap-2 rounded-lg border border-(--err)/30 bg-(--err)/10 p-3 text-sm text-(--err)">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{launchError}</span>
          </div>
        )}
        <button
          onClick={configureAndLaunch}
          disabled={configuringRecipe}
          className="inline-flex items-center gap-2 rounded-lg bg-(--hl1) px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {configuringRecipe ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="h-4 w-4" />
          )}
          {configuringRecipe ? "Launching..." : "Configure & Launch"}
        </button>
      </div>
    </div>
  );
}
