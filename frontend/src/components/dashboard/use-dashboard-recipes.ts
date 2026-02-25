// CRITICAL
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import type { ProcessInfo, RecipeWithStatus } from "@/lib/types";

export function useDashboardRecipes(currentProcess: ProcessInfo | null) {
  const [recipes, setRecipes] = useState<RecipeWithStatus[]>([]);
  const [currentRecipe, setCurrentRecipe] = useState<RecipeWithStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const selectTargetLogSession = useCallback(
    (
      sessions: Array<{
        id: string;
        recipe_id?: string;
        status: string;
        backend?: string;
        model_path?: string;
        model?: string;
      }>,
      runningRecipe: RecipeWithStatus | null,
    ) => {
      if (sessions.length === 0) return null;

      if (currentProcess) {
        const byProcess = sessions.find((session) => {
          if (session.status !== "running") return false;
          if (session.model_path && currentProcess.model_path) {
            return session.model_path === currentProcess.model_path;
          }
          if (session.model && currentProcess.served_model_name) {
            return session.model === currentProcess.served_model_name;
          }
          return session.backend === currentProcess.backend;
        });
        if (byProcess) return byProcess;

        const servedModel = currentProcess.served_model_name?.toLowerCase();
        if (servedModel) {
          const byName = sessions.find((session) =>
            (session.id ?? "").toLowerCase().includes(servedModel),
          );
          if (byName) return byName;
        }
      }

      if (runningRecipe) {
        const byRecipe = sessions.find(
          (session) => session.status === "running" || session.recipe_id === runningRecipe.id,
        );
        if (byRecipe) return byRecipe;
      }

      return sessions[0];
    },
    [currentProcess],
  );

  const refreshLogs = useCallback(
    async (runningRecipe: RecipeWithStatus | null, limit = 220) => {
      try {
        const sessions = await api.getLogSessions();
        const list = sessions.sessions || [];
        if (list.length === 0) {
          setLogs([]);
          return;
        }
        const targetSession = selectTargetLogSession(list, runningRecipe);
        if (!targetSession) {
          setLogs([]);
          return;
        }
        const logData = await api.getLogs(targetSession.id, limit).catch(() => ({ logs: [] }));
        setLogs(logData.logs || []);
      } catch {
        setLogs([]);
      }
    },
    [selectTargetLogSession],
  );

  const reload = useCallback(async () => {
    try {
      const data = await api.getRecipes();
      const list = data.recipes || [];
      setRecipes(list);

      // Find running recipe if any
      const running = currentProcess
        ? list.find((r: RecipeWithStatus) => r.status === "running") || null
        : null;
      setCurrentRecipe(running);
      await refreshLogs(running);
    } catch (e) {
      console.error("Failed to load recipes:", e);
    } finally {
      setLoading(false);
    }
  }, [currentProcess, refreshLogs]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const handler = () => {
      void reload();
    };
    window.addEventListener("vllm:recipe-event", handler as EventListener);
    return () => {
      window.removeEventListener("vllm:recipe-event", handler as EventListener);
    };
  }, [reload]);

  useEffect(() => {
    if (!currentProcess) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      await refreshLogs(currentRecipe);
    };
    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [currentProcess, currentRecipe, refreshLogs]);

  return { recipes, currentRecipe, logs, loading, reload };
}
