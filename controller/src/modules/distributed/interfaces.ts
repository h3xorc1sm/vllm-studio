export interface DistributedRoutes {
  registerRoutes(): void;
}

export interface DistributedClusterConfig {
  heartbeatIntervalMs: number;
}
