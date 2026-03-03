// CRITICAL
"use client";

import { useRunMachine } from "@/lib/systems/run-machine";
import type { UseRunEventHandlerArgs } from "./use-run-event-handler/types";

export function useRunEventHandler(args: UseRunEventHandlerArgs) {
  const { handleRunEvent } = useRunMachine(args);
  return handleRunEvent;
}
