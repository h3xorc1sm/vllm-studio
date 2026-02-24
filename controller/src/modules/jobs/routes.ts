// CRITICAL
import type { Hono } from "hono";
import type { AppContext } from "../../types/context";
import type { JobManager } from "./job-manager";
import type { JobType } from "./types";
import { badRequest, notFound } from "../../core/errors";
import { SUPPORTED_JOB_TYPES } from "./configs";

/**
 * Register jobs API routes.
 * @param app - Hono application.
 * @param _context
 * @param jobManager - Job manager instance.
 */
export const registerJobsRoutes = (
  app: Hono,
  _context: AppContext,
  jobManager: JobManager,
): void => {
  app.post("/jobs", async (ctx) => {
    const body = await ctx.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw badRequest("Invalid JSON payload");
    }

    const type = typeof body["type"] === "string" ? body["type"] : "";
    if (!type) {
      throw badRequest("type is required");
    }
    if (!SUPPORTED_JOB_TYPES.has(type as JobType)) {
      throw badRequest(
        `Unsupported job type: ${type}. Supported: ${[...SUPPORTED_JOB_TYPES].join(", ")}`
      );
    }
    const jobType = type as JobType;

    const input =
      body["input"] && typeof body["input"] === "object"
        ? (body["input"] as Record<string, unknown>)
        : {};

    try {
      const job = await jobManager.createJob(jobType, input);
      return ctx.json({ job }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw badRequest(message);
    }
  });

  app.get("/jobs", (ctx) => {
    const limitRaw = ctx.req.query("limit");
    const parsedLimit = limitRaw === undefined ? Number.NaN : Number.parseInt(limitRaw, 10);
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;
    const jobs = jobManager.listJobs(Math.min(safeLimit, 200));
    return ctx.json({ jobs });
  });

  app.get("/jobs/:jobId", (ctx) => {
    const jobId = ctx.req.param("jobId");
    const job = jobManager.getJob(jobId);
    if (!job) {
      throw notFound("Job not found");
    }
    return ctx.json({ job });
  });
};
