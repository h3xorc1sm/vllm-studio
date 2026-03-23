"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BookOpen, ExternalLink, HardDrive, Rocket, Server, TerminalSquare } from "lucide-react";
import { UiInsetSurface, UiStatusBadge } from "@/components/ui-kit";
import api from "@/lib/api";
import type { ProcessInfo, RecipeWithStatus, StudioDiagnostics, StudioSettings } from "@/lib/types";
import { formatBytes } from "../setup/_components/setup-view/utils";
import { buildHermesConnectionInfo } from "./hermes";

interface GetStartedData {
  settings: StudioSettings;
  diagnostics: StudioDiagnostics;
  process: ProcessInfo | null;
  recipes: RecipeWithStatus[];
}

export default function GetStartedPage() {
  const [data, setData] = useState<GetStartedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [settings, diagnostics, status, recipes] = await Promise.all([
          api.getStudioSettings(),
          api.getStudioDiagnostics(),
          api.getStatus().catch(() => ({ process: null })),
          api.getRecipes().catch(() => ({ recipes: [] })),
        ]);
        if (cancelled) return;
        setData({
          settings,
          diagnostics,
          process: status.process ?? null,
          recipes: recipes.recipes ?? [],
        });
      } catch (nextError) {
        if (cancelled) return;
        setError(
          nextError instanceof Error ? nextError.message : "Failed to load Get Started data",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeRecipe = useMemo(() => {
    if (!data) return null;
    return data.recipes.find((recipe) => recipe.status === "running") ?? data.recipes[0] ?? null;
  }, [data]);

  const hermesInfo = useMemo(() => {
    if (!data) return null;
    return buildHermesConnectionInfo({
      diagnostics: data.diagnostics,
      recipe: activeRecipe,
      process: data.process,
      browserHostname: typeof window === "undefined" ? null : window.location.hostname,
    });
  }, [activeRecipe, data]);

  return (
    <div className="min-h-full overflow-y-auto bg-(--surface) text-(--fg)">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-(--dim)">Get Started</div>
          <h1 className="text-2xl font-semibold">Desktop onboarding and Hermes deployment</h1>
          <p className="max-w-3xl text-sm text-(--dim)">
            Use the same Studio setup flow for a fresh device, then point Hermes Agent at the
            resulting OpenAI-compatible vLLM endpoint.
          </p>
        </div>

        {loading && (
          <UiInsetSurface>
            <div className="text-sm text-(--dim)">Loading current Studio state...</div>
          </UiInsetSurface>
        )}

        {error && (
          <UiInsetSurface className="border-(--err)/30 bg-(--err)/10">
            <div className="text-sm text-(--err)">{error}</div>
          </UiInsetSurface>
        )}

        {data && hermesInfo && (
          <div className="grid gap-6 lg:grid-cols-2">
            <UiInsetSurface className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Rocket className="h-4 w-4 text-(--hl1)" />
                    <span>Desktop App</span>
                  </div>
                  <h2 className="text-xl font-medium">Onboard this device</h2>
                </div>
                <UiStatusBadge tone={data.diagnostics.runtime.vllm_installed ? "success" : "info"}>
                  {data.diagnostics.runtime.vllm_installed ? "runtime detected" : "runtime missing"}
                </UiStatusBadge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryItem
                  icon={<HardDrive className="h-4 w-4 text-(--dim)" />}
                  label="Models directory"
                  value={data.settings.effective.models_dir}
                />
                <SummaryItem
                  icon={<Server className="h-4 w-4 text-(--dim)" />}
                  label="GPU / VRAM"
                  value={
                    data.diagnostics.gpus[0]?.memory_total_mb
                      ? `${Math.round(data.diagnostics.gpus[0].memory_total_mb / 1024)} GB`
                      : "CPU-only"
                  }
                />
                <SummaryItem
                  icon={<Server className="h-4 w-4 text-(--dim)" />}
                  label="Runtime"
                  value={data.diagnostics.runtime.vllm_version ?? "Not installed"}
                />
                <SummaryItem
                  icon={<BookOpen className="h-4 w-4 text-(--dim)" />}
                  label="Active model"
                  value={hermesInfo.modelName}
                />
              </div>

              <div className="rounded-lg border border-(--border) bg-(--surface) p-4 text-sm text-(--dim)">
                The setup wizard now confirms hardware, downloads the starter model, creates the
                recipe, launches it, and waits for an explicit benchmark before sending you to chat.
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/setup"
                  className="inline-flex items-center gap-2 rounded-lg bg-(--hl1) px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  <Rocket className="h-4 w-4" />
                  Start Setup
                </Link>
                <Link
                  href="/recipes"
                  className="inline-flex items-center gap-2 rounded-lg border border-(--surface) px-4 py-2 text-sm text-(--fg) hover:bg-(--surface)"
                >
                  <BookOpen className="h-4 w-4" />
                  Review Recipes
                </Link>
              </div>
            </UiInsetSurface>

            <UiInsetSurface className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <TerminalSquare className="h-4 w-4 text-(--hl1)" />
                    <span>Hermes Agent</span>
                  </div>
                  <h2 className="text-xl font-medium">Deploy to a Hermes Agent</h2>
                </div>
                <UiStatusBadge tone={hermesInfo.recipeHermesReady ? "success" : "info"}>
                  {hermesInfo.recipeHermesReady ? "recipe ready" : "set Hermes parser"}
                </UiStatusBadge>
              </div>

              <div className="space-y-3 text-sm text-(--dim)">
                <p>
                  Use the running or most recent Studio recipe as the Hermes target. In Studio
                  Recipes, set <span className="text-(--fg)">Tool Call Parser = Hermes</span> and
                  turn on <span className="text-(--fg)">Enable Auto Tool Choice</span>.
                </p>
                {hermesInfo.needsRemoteHostReplacement && (
                  <div className="rounded-lg border border-(--hl3)/30 bg-(--hl3)/10 p-3 text-sm text-(--fg)">
                    Studio is currently exposing a localhost-style inference host. If Hermes runs on
                    another machine, replace <span className="font-mono">localhost</span> with the
                    Studio machine IP or DNS name before saving the custom endpoint.
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryItem
                  icon={<Server className="h-4 w-4 text-(--dim)" />}
                  label="Hermes base URL"
                  value={hermesInfo.baseUrl}
                />
                <SummaryItem
                  icon={<BookOpen className="h-4 w-4 text-(--dim)" />}
                  label="Hermes model"
                  value={hermesInfo.modelName}
                />
                <SummaryItem
                  icon={<HardDrive className="h-4 w-4 text-(--dim)" />}
                  label="API key"
                  value={
                    hermesInfo.apiKeyConfigured
                      ? "Required by Studio config"
                      : "Leave blank / local"
                  }
                />
                <SummaryItem
                  icon={<Server className="h-4 w-4 text-(--dim)" />}
                  label="Memory"
                  value={formatBytes(data.diagnostics.memory_total)}
                />
              </div>

              <SnippetBlock
                title="Hermes custom endpoint"
                lines={[
                  "hermes model",
                  "# Choose: Custom Endpoint / OpenAI-compatible endpoint",
                  `# Base URL: ${hermesInfo.baseUrl}`,
                  `# Model: ${hermesInfo.modelName}`,
                  `# API key: ${hermesInfo.apiKeyConfigured ? "<your-studio-api-key>" : "<leave blank if local>"}`,
                ]}
              />

              <SnippetBlock
                title="Manual environment path"
                lines={[
                  `export OPENAI_BASE_URL=\"${hermesInfo.baseUrl}\"`,
                  `export OPENAI_API_KEY=\"${hermesInfo.apiKeyConfigured ? "<your-studio-api-key>" : ""}\"`,
                  `export LLM_MODEL=\"${hermesInfo.modelName}\"`,
                ]}
              />

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/recipes"
                  className="inline-flex items-center gap-2 rounded-lg bg-(--hl1) px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  <BookOpen className="h-4 w-4" />
                  Configure Recipe
                </Link>
                <a
                  href="https://hermes-agent.nousresearch.com/docs/user-guide/configuration/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-(--surface) px-4 py-2 text-sm text-(--fg) hover:bg-(--surface)"
                >
                  <ExternalLink className="h-4 w-4" />
                  Hermes Docs
                </a>
              </div>
            </UiInsetSurface>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-(--border) bg-(--surface) p-4">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-(--dim)">
        {icon}
        <span>{label}</span>
      </div>
      <div className="break-all text-sm text-(--fg)">{value}</div>
    </div>
  );
}

function SnippetBlock({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wider text-(--dim)">{title}</div>
      <pre className="overflow-x-auto rounded-lg border border-(--border) bg-(--bg) p-4 text-xs text-(--fg)">
        <code>{lines.join("\n")}</code>
      </pre>
    </div>
  );
}
