# Setup Guide

## Prerequisites

- Node.js 20+
- Bun 1.3+
- Docker + Docker Compose
- `git`

## Local setup

1. Install dependencies:
```bash
cd controller && bun install
cd ../frontend && npm ci
```

2. Configure environment:
- create local `.env` values for API keys, backend URLs, and optional model/runtime settings
- keep secrets out of git

3. Run controller:
```bash
cd controller
bun src/main.ts
```

4. Run frontend:
```bash
cd frontend
npm run dev
```

## Validation checklist

Run before release:

```bash
cd controller
npx tsc --noEmit
bun test

cd ../frontend
npm run test
npm run lint
npm run build
```

## Docker deployment

### Local/remote compose deployment

```bash
docker compose up -d --build controller frontend
docker compose ps controller frontend
```

### Verify services

```bash
curl -sS http://localhost:8080/health
curl -I http://localhost:3000
```

## Remote host example (SSH + deploy)

```bash
ssh -i ~/.ssh/linux-ai ser@192.168.1.70
cd /home/ser/workspace/projects/lmvllm
docker compose up -d --build controller frontend
docker compose ps controller frontend
```

## Persistence

Services are configured with restart policy:
- `vllm-studio-controller`: `unless-stopped`
- `vllm-studio-frontend`: `unless-stopped`

## Troubleshooting

1. Controller restart loop:
- inspect logs: `docker logs --tail 200 vllm-studio-controller`
- verify module/file sync if deployment was partial

2. Frontend can’t reach backend:
- check `BACKEND_URL` in compose env
- verify `http://localhost:8080/health`

3. Slow rebuilds:
- ensure `.dockerignore` is present and excludes heavy local directories
