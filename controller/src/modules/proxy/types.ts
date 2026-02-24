export interface ProxyModuleConfig {
  feature: "proxy";
}

export interface ProxyRouteContext {
  apiKey?: string;
}

export type Utf8State = {
  pendingContent: string;
  pendingReasoning: string;
};
