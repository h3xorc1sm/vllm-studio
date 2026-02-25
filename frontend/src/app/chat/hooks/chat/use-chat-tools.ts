// CRITICAL
"use client";

import { useCallback } from "react";
import type { MCPTool, MCPServer, ToolResult } from "@/lib/types";
import { useAppStore } from "@/store";
import { useShallow } from "zustand/react/shallow";

interface UseChatToolsOptions {
  mcpEnabled: boolean;
}

export function useChatTools({ mcpEnabled: _mcpEnabled }: UseChatToolsOptions) {
  const {
    mcpTools,
    mcpServers,
    executingTools,
    toolResultsMap,
    setMcpTools,
    setMcpServers,
    setExecutingTools,
    updateExecutingTools,
    setToolResultsMap,
    updateToolResultsMap,
  } = useAppStore(
    useShallow((state) => ({
      mcpTools: state.mcpTools,
      mcpServers: state.mcpServers,
      executingTools: state.executingTools,
      toolResultsMap: state.toolResultsMap,
      setMcpTools: state.setMcpTools,
      setMcpServers: state.setMcpServers,
      setExecutingTools: state.setExecutingTools,
      updateExecutingTools: state.updateExecutingTools,
      setToolResultsMap: state.setToolResultsMap,
      updateToolResultsMap: state.updateToolResultsMap,
    })),
  );

  const loadMCPServers = useCallback(async () => {
    setMcpServers([]);
  }, [setMcpServers]);

  const loadMCPTools = useCallback(async (): Promise<MCPTool[]> => {
    setMcpTools([]);
    return [];
  }, [setMcpTools]);

  const getToolDefinitions = useCallback((_toolsOverride?: MCPTool[]): MCPTool[] => [], []);

  const executeTool = useCallback(
    async (toolCall: { toolCallId: string; toolName: string; args?: Record<string, unknown> }) => {
      const { toolCallId, toolName: rawToolName } = toolCall;

      updateExecutingTools((prev) => new Set(prev).add(toolCallId));

      try {
        const toolResult: ToolResult = {
          tool_call_id: toolCallId,
          content: `MCP tool execution is disabled: ${rawToolName}`,
          isError: true,
        };

        updateToolResultsMap((prev) => new Map(prev).set(toolCallId, toolResult));
        return toolResult;
      } catch (err) {
        const errorResult: ToolResult = {
          tool_call_id: toolCallId,
          content: err instanceof Error ? err.message : "Tool execution failed",
          isError: true,
        };
        updateToolResultsMap((prev) => new Map(prev).set(toolCallId, errorResult));
        return errorResult;
      } finally {
        updateExecutingTools((prev) => {
          const next = new Set(prev);
          next.delete(toolCallId);
          return next;
        });
      }
    },
    [updateExecutingTools, updateToolResultsMap],
  );

  const addMcpServer = useCallback(async (_server: MCPServer) => {}, []);

  const updateMcpServer = useCallback(async (_server: MCPServer) => {}, []);

  const removeMcpServer = useCallback(async (_serverId: string) => {}, []);

  const clearToolResults = useCallback(() => {
    setToolResultsMap(new Map());
    setExecutingTools(new Set());
  }, [setExecutingTools, setToolResultsMap]);

  return {
    mcpTools,
    mcpServers,
    executingTools,
    toolResultsMap,
    loadMCPServers,
    loadMCPTools,
    getToolDefinitions,
    executeTool,
    addMcpServer,
    updateMcpServer,
    removeMcpServer,
    clearToolResults,
    setMcpServers,
  };
}
