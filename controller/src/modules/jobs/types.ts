export interface JobsModuleConfig {
  feature: "jobs";
}

export type JobType = "voice_assistant_turn";

export type JobModuleState = "running" | "completed" | "failed";
