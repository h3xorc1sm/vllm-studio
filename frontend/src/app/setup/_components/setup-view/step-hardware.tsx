// CRITICAL
"use client";

import { ChevronRight, Cpu, DownloadCloud, HardDrive, Loader2 } from "lucide-react";
import type { StudioDiagnostics, VllmUpgradeResult } from "@/lib/types";
import { formatBytes } from "./utils";

export function StepHardware({
  diagnostics,
  upgradeRuntime,
  upgrading,
  upgradeResult,
  hardwareConfirmed,
  setHardwareConfirmed,
  continueFromHardware,
}: {
  diagnostics: StudioDiagnostics | null;
  upgradeRuntime: () => void;
  upgrading: boolean;
  upgradeResult: VllmUpgradeResult | null;
  hardwareConfirmed: boolean;
  setHardwareConfirmed: (value: boolean) => void;
  continueFromHardware: () => void;
}) {
  return (
    <div className="grid gap-6">
      <div className="bg-(--bg) border border-(--surface) rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Cpu className="h-5 w-5 text-(--hl1)" />
          <h2 className="text-lg font-medium">Hardware Check</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-(--dim)">
          <div>
            <div className="text-xs text-(--dim) mb-1">CPU</div>
            <div>
              {diagnostics?.cpu_model ?? "Unknown"} · {diagnostics?.cpu_cores ?? 0} cores
            </div>
          </div>
          <div>
            <div className="text-xs text-(--dim) mb-1">Memory</div>
            <div>{formatBytes(diagnostics?.memory_total ?? null)} total</div>
          </div>
          <div>
            <div className="text-xs text-(--dim) mb-1">GPU</div>
            <div>
              {diagnostics?.gpus?.length
                ? diagnostics.gpus.map((gpu) => gpu.name).join(", ")
                : "No CUDA GPU detected"}
            </div>
          </div>
          <div>
            <div className="text-xs text-(--dim) mb-1">VRAM</div>
            <div>
              {diagnostics?.gpus?.[0]?.memory_total_mb
                ? `${Math.round(diagnostics.gpus[0].memory_total_mb / 1024)} GB`
                : "CPU only"}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-(--bg) border border-(--surface) rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <HardDrive className="h-5 w-5 text-(--hl1)" />
          <h2 className="text-lg font-medium">Runtime</h2>
        </div>
        <div className="text-sm text-(--dim)">
          {diagnostics?.runtime.vllm_installed
            ? `vLLM ${diagnostics.runtime.vllm_version ?? ""} detected.`
            : "vLLM runtime not detected. Install to continue."}
        </div>
        {upgradeResult && (
          <div className={`text-xs ${upgradeResult.success ? "text-(--hl2)" : "text-(--err)"}`}>
            {upgradeResult.success
              ? `Updated to vLLM ${upgradeResult.version}`
              : upgradeResult.error}
          </div>
        )}
        <label className="flex items-start gap-3 rounded-lg border border-(--surface) bg-(--surface)/40 px-4 py-3 text-sm text-(--dim)">
          <input
            type="checkbox"
            checked={hardwareConfirmed}
            onChange={(event) => setHardwareConfirmed(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-(--border) bg-(--bg)"
          />
          <span>
            I confirmed this hardware summary matches the device I am onboarding, and I want vLLM
            Studio to continue using these detected capabilities.
          </span>
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={upgradeRuntime}
            disabled={upgrading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-(--surface) text-sm hover:bg-(--surface) disabled:opacity-60"
          >
            {upgrading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <DownloadCloud className="h-4 w-4" />
            )}
            Install / Upgrade vLLM
          </button>
          <button
            onClick={continueFromHardware}
            disabled={!hardwareConfirmed}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-(--hl1) text-white text-sm hover:opacity-90 disabled:opacity-50"
          >
            Continue
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
