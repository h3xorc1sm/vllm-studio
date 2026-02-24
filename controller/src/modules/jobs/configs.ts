import type { JobType } from "./types";

export const JOBS_MODULE_DEFAULTS = {
  maxConcurrentJobs: 2,
};

export const SUPPORTED_JOB_TYPES: ReadonlySet<JobType> = new Set<JobType>(["voice_assistant_turn"]);

export const VOICE_ASSISTANT_PROGRESS = {
  sttComplete: 10,
  llmStart: 20,
  llmComplete: 30,
  llmPosted: 70,
  ttsStart: 80,
  completed: 100,
} as const;

export const VOICE_ASSISTANT_TEXT_FETCH_TIMEOUT_MS = 120_000;
export const VOICE_ASSISTANT_TTS_INPUT_LIMIT_CHARS = 2_000;
export const VOICE_ASSISTANT_SNIPPET_LENGTH_CHARS = 80;
