export interface ChatRoutes {
  registerRoutes(): void;
}

export interface ChatStoreLike {
  getSession(sessionId: string): unknown;
}
