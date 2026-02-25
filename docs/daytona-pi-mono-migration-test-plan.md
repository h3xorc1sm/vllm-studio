# Daytona + Pi-Mono Migration Regression Plan

## Goal
Ensure MCP and local AgentFS removal does not regress chat runs, tool execution, or file operations.

## Automated Tests
1. `controller/src/modules/chat/agent-files/store.test.ts`
Confirms session filesystem access fails when Daytona mode is disabled, preventing local AgentFS fallback.

2. `controller/src/tests/tool-call-core.test.ts`
Confirms legacy `<use_mcp_tool>` XML blocks are ignored and not converted into tool calls.

3. `frontend/src/lib/api/create-api-client.test.ts`
Confirms frontend API client no longer exposes MCP methods.

## Integration Validation
1. Agent run with `agent_mode=true` executes `execute_command` and returns tool lifecycle events.
2. Agent file tools (`write_file`, `read_file`, `list_files`) succeed through Daytona toolbox endpoints.
3. Chat turn request without `mcp_enabled` still streams correctly.
4. `/mcp/*` endpoints return not found after backend route removal.

## Release Gate
1. `cd controller && bun test && npx tsc --noEmit`
2. `cd frontend && npm run test && npm run lint && npm run build`
3. Manual chat smoke test with Activity tab visible:
thinking pulse text, tool-call single-line updates, and right panel activity stream.
