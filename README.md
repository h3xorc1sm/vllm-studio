# vLLM Studio

Unified local AI workstation for model lifecycle, chat/agent workflows, orchestration, observability, and remote deployment.

## Release: v1.12.0

This release consolidates major repo changes currently in the tree, including:
- controller module reorganization and typed module boundaries
- chat send/stream reliability fixes (done-state detection, attachment/send flow, rollback behavior)
- SSE/run queue hardening to reduce stuck/incomplete UI states
- frontend input and toolbar refinements
- Dockerized controller runtime and compose wiring for persistent frontend+backend services
- repository cleanup and docs reset

## Docs

- Overview: docs/README.md
- Setup and deployment: setup/README.md
- Environment variables: docs/environment.md

## Repository layout

- `controller/`: Bun/Hono backend, orchestration, chat runtime, lifecycle, metrics
- `frontend/`: Next.js app, chat UI, proxy endpoints, client state
- `cli/`: Bun CLI for controller access
- `desktop/`: daemon scripts for running the controller in the background
- `swift-client/`: iOS/macOS client (XcodeGen)
- `shared/`: shared types/contracts
- `config/`: runtime and integration configs
- `docs/`: documentation index and environment notes
- `scripts/`: operational scripts
- `docker-compose.yml`: full stack service definitions
- `start.sh`: controller + infra launcher

## Quick start

1. Controller (local):
```bash
cd controller
npx tsc --noEmit
bun test
bun src/main.ts
```

2. Frontend:
```bash
cd frontend
npm run test
npm run lint
npm run build
npm run dev
```

3. Full stack with Docker (controller + frontend + infra):
```bash
docker compose up -d --build controller frontend
```

4. Convenience entrypoint (controller + infra only):
```bash
./start.sh --dev
```

## Health checks

```bash
curl -sS http://localhost:8080/health
curl -I http://localhost:3000
```

## API docs

- http://localhost:8080/api/docs
- http://localhost:8080/api/spec

## Setup guide

See `setup/README.md` for complete setup, deployment, and verification instructions.

## Branching and release workflow

- Development branch: `dev`
- Production integration branch: `main`
- Release tags: `vX.Y.Z`

For this release:
- merge release work into `main` and `dev`
- tag `v1.12.0`
- create a new post-release working branch
