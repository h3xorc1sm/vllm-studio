import type { JobType } from "./types";

/**
 * Orchestrator interface for job execution.
 */
export interface Orchestrator {
  /** Human-readable name. */
  readonly name: string;

  /**
   * Workflow type discriminator.
   */
  execute(
    jobId: string,
    type: JobType,
    input: Record<string, unknown>,
    reporter: JobReporter,
  ): Promise<Record<string, unknown>>;
}

export interface JobReporter {
  progress(pct: number): void;
  log(message: string): void;
  status(status: "running" | "completed" | "failed"): void;
}
