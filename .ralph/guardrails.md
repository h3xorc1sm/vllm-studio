# Ralph Guardrails

## Sign: Preserve Existing User Work
- Trigger: Dirty working tree at task start
- Instruction: Never revert or overwrite unrelated user changes.

## Sign: Evidence Over Claims
- Trigger: Large-scale cleanup/refactor tasks
- Instruction: Generate deterministic file-ledger and command-backed verification before claiming completion.

## Sign: Subproject Tooling Boundaries
- Trigger: vLLM-Studio repo checks
- Instruction: Run frontend checks in `frontend/` and controller checks in `controller/`.

## Sign: Shebang Marker Placement
- Trigger: CRITICAL-marker linting in executable files
- Instruction: Allow marker on line 2 only when line 1 is a shebang.
