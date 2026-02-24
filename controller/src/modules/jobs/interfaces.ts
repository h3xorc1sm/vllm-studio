import type { JobType } from "./types";

export interface JobsRoutes {
  registerRoutes(): void;
}

export interface JobStoreShape {
  createJob(type: JobType, input: unknown): unknown;
}
