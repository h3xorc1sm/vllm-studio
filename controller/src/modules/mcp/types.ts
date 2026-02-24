export interface McpModuleConfig {
  feature: "mcp";
}

export interface McpToolProfile {
  serverId: string;
}

export interface McpServer {
  id: string;
  name: string;
  enabled: boolean;
  command: string;
  args: string[];
  env: Record<string, string>;
  description: string | null;
  url: string | null;
}
