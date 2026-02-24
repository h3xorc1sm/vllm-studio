import type { AppContext } from "../../types/context";
import type { JobRecord, JobStore } from "../../stores/job-store";
import type { JobReporter } from "./orchestrator";
import type { JobType } from "./types";
import { AutoOrchestrator } from "./auto-orchestrator";

/**
 * Creates a JobReporter that persists updates to the store and emits events.
 * @returns Reporter implementation used to emit progress and logs.
 * @param jobId
 * @param store
 * @param context
 */
function createReporter(jobId: string, store: JobStore, context: AppContext): JobReporter {
  return {
    progress(pct: number): void {
      store.update(jobId, { progress: Math.min(100, Math.max(0, pct)) });
      void emitJobUpdate(jobId, store, context);
    },
    log(message: string): void {
      store.appendLog(jobId, message);
    },
    status(status: "running" | "completed" | "failed"): void {
      store.update(jobId, { status });
      void emitJobUpdate(jobId, store, context);
    },
  };
}

/**
 * Emit a job update event for listeners after persistence.
 *
 * @param jobId
 * @param store
 * @param context
 * @returns Promise that resolves when update event is published.
 */
async function emitJobUpdate(jobId: string, store: JobStore, context: AppContext): Promise<void> {
  const job = store.get(jobId);
  if (job) {
    await context.eventManager.publishJobUpdated(serializeJob(job));
  }
}

/**
 * Serialize a job record for API/event transport.
 * @returns Serialized job payload used by API and event consumers.
 * @param job
 */
export function serializeJob(job: JobRecord): Record<string, unknown> {
  let logs: string[] = [];
  try {
    logs = JSON.parse(job.logs) as string[];
  } catch {
    logs = [];
  }
  let inputParsed: unknown = {};
  try {
    inputParsed = JSON.parse(job.input);
  } catch {
    inputParsed = {};
  }
  let resultParsed: unknown = null;
  if (job.result) {
    try {
      resultParsed = JSON.parse(job.result);
    } catch {
      resultParsed = job.result;
    }
  }
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    progress: job.progress,
    input: inputParsed,
    result: resultParsed,
    error: job.error,
    logs,
    created_at: job.created_at,
    updated_at: job.updated_at,
  };
}

/**
 * Job lifecycle manager.
 */
export class JobManager {
  private readonly context: AppContext;
  private readonly store: JobStore;
  private readonly orchestrator: AutoOrchestrator;

  /**
   * Create a new job instance and start execution.
   *
   * @returns Serialized created job payload.
   * @param context
   * @param store
   */
  public constructor(context: AppContext, store: JobStore) {
    this.context = context;
    this.store = store;
    this.orchestrator = new AutoOrchestrator(context);
  }

  /**
   * Create and start a job.
   * @param type - Workflow type.
   * @param input - Workflow input.
   * @returns Created job record (serialized).
   */
  public async createJob(
    type: JobType,
    input: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job = this.store.create(id, type, input);
    const reporter = createReporter(id, this.store, this.context);

    // Fire and forget — workflow runs in background
    void this.runJob(id, type, input, reporter);

    return serializeJob(job);
  }

  /**
   * Execute a job and persist final state.
   *
   * @returns Promise that resolves when job persistence has been updated.
   * @param id
   * @param type
   * @param input
   * @param reporter
   */
  private async runJob(
    id: string,
    type: JobType,
    input: Record<string, unknown>,
    reporter: JobReporter
  ): Promise<void> {
    try {
      const result = await this.orchestrator.execute(id, type, input, reporter);
      this.store.update(id, {
        status: "completed",
        progress: 100,
        result: JSON.stringify(result),
      });
    } catch (error) {
      this.store.update(id, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
      reporter.log(`Job failed: ${String(error)}`);
    }
    void emitJobUpdate(id, this.store, this.context);
  }

  /**
   * Get a job by id.
   * @param id - Job identifier.
   * @returns Serialized job or null.
   */
  public getJob(id: string): Record<string, unknown> | null {
    const job = this.store.get(id);
    return job ? serializeJob(job) : null;
  }

  /**
   * List recent jobs.
   * @param limit - Max results.
   * @returns Serialized job list.
   */
  public listJobs(limit = 50): Record<string, unknown>[] {
    return this.store.list(limit).map(serializeJob);
  }
}
