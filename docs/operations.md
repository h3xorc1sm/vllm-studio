# Operations

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Remote host: 192.168.1.70  (AMD EPYC 7443P, 504 GB, 8× 3090) │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Native on host                                             │ │
│  │                                                             │ │
│  │  controller (bun)    :8080  lifecycle, GPU, chat, recipes   │ │
│  │  frontend   (next)   :3000  web UI                          │ │
│  │  vLLM / SGLang       :8000  inference (managed separately)  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Docker (infra only)                                        │ │
│  │                                                             │ │
│  │  postgres:16         :5432  LiteLLM database                │ │
│  │  litellm             :4100  API gateway / cost tracking     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

Controller and frontend run **natively** (not in Docker) because the controller
needs `nvidia-smi` for GPU monitoring and `/proc` visibility to detect running
inference processes.

## Deployment

### Prerequisites

- **Remote**: Bun 1.3+, Node.js 20+, Docker, nvidia driver
- **Local**: SSH key at `~/.ssh/linux-ai`, rsync

### Deploy

```bash
./scripts/deploy-remote.sh            # full deploy
./scripts/deploy-remote.sh controller # controller only
./scripts/deploy-remote.sh frontend   # frontend only
./scripts/deploy-remote.sh status     # check what's running
```

The script does four things in order:

1. **rsync** — pushes `controller/src/`, `frontend/src/`, `shared/`, `config/` to the remote
2. **install** — runs `bun install` and `npm install` on the remote
3. **restart** — kills old processes, starts new ones via `nohup`, waits for the port
4. **verify** — hits every health endpoint and prints GPU / model status

### SSH access

```bash
ssh -i ~/.ssh/linux-ai ser@192.168.1.70
```

Key file: `~/.ssh/linux-ai` (RSA key, no passphrase).
Remote project path: `/home/ser/workspace/projects/lmvllm`.

### Logs

```bash
ssh -i ~/.ssh/linux-ai ser@192.168.1.70 tail -f /tmp/controller-stdout.log
ssh -i ~/.ssh/linux-ai ser@192.168.1.70 tail -f /tmp/frontend-stdout.log
ssh -i ~/.ssh/linux-ai ser@192.168.1.70 docker logs -f vllm-studio-litellm
```

## Health endpoints

| Endpoint | URL |
|---|---|
| Controller health | `GET :8080/health` |
| Controller status | `GET :8080/status` |
| GPU list | `GET :8080/gpus` |
| OpenAPI spec | `GET :8080/api/spec` |
| Swagger UI | `GET :8080/api/docs` |
| Frontend | `GET :3000` |
| Frontend proxy | `GET :3000/api/proxy/health` |
| LiteLLM | `GET :4100/health` (requires API key header) |
| vLLM | `GET :8000/v1/models` |

## Local development

```bash
cd controller && bun install && bun --watch src/main.ts
cd frontend && npm install && npm run dev
```

Set `VLLM_STUDIO_MOCK_INFERENCE=true` in `.env` to run without a real inference backend.

## Data and persistence

- Controller SQLite DB: `data/controller.db`
- Chat history: `data/chats/`
- Model logs: `data/logs/`
- Postgres data: `data/postgres/` (Docker volume mount)
