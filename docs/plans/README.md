# Backend ↔ Frontend ↔ Database Maintainability Plan Pack

These docs are a focused maintainability pack for the controller, frontend, and persistence layer.

## Documents

1. [`01-current-wiring-and-state-machines.md`](./01-current-wiring-and-state-machines.md)
   - End-to-end wiring map from UI to controller to DB.
   - State machines for model switch, chat run streaming, and frontend event sync.

2. [`02-priority-roadmap.md`](./02-priority-roadmap.md)
   - Priority-ranked actions (P0/P1/P2) to reduce complexity and drift.
   - Concrete deliverables and measurable success criteria.

3. [`03-execution-workpacks.md`](./03-execution-workpacks.md)
   - Sprint-style workpacks with scope, tasks, tests, and outputs.
   - Designed for parallel execution without losing system coherence.
