export interface MonitoringModuleConfig {
  feature: "monitoring";
}

export interface MonitoringEventPayload {
  type: string;
  payload: Record<string, unknown>;
}
