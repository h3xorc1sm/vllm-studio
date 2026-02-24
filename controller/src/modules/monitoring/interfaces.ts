export interface MonitoringRoutes {
  registerRoutes(): void;
}

export interface MonitoringStoreLike {
  getMetrics(): Record<string, unknown>;
}
