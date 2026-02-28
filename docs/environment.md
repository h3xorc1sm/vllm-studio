# Environment Variables

This list documents environment variables referenced in code or docker-compose. Defaults are taken from code or compose when known.

## Controller core

| Variable                         | Default                    | Purpose                                                                                               |
| -------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| VLLM_STUDIO_HOST                 | 0.0.0.0                    | Bind address for the controller server.                                                               |
| VLLM_STUDIO_PORT                 | 8080                       | Controller HTTP port.                                                                                 |
| VLLM_STUDIO_API_KEY              | -                          | Optional API key for authenticated requests.                                                          |
| VLLM_STUDIO_INFERENCE_PORT       | 8000                       | Port used to reach the inference backend.                                                             |
| VLLM_STUDIO_DATA_DIR             | ./data or ../data          | Data directory (depends on working directory).                                                        |
| VLLM_STUDIO_DB_PATH              | <data>/controller.db       | SQLite database path.                                                                                 |
| VLLM_STUDIO_MODELS_DIR           | /models                    | Models directory (overridden by persisted config).                                                    |
| VLLM_STUDIO_LITELLM_DATABASE_URL | -                          | Preferred LiteLLM database URL (falls back to LITELLM_DATABASE_URL or DATABASE_URL).                  |
| LITELLM_DATABASE_URL             | -                          | LiteLLM database URL fallback.                                                                        |
| DATABASE_URL                     | -                          | Database URL fallback used by LiteLLM.                                                                |
| VLLM_STUDIO_STRICT_OPENAI_MODELS | -                          | When truthy, restricts to explicit OpenAI models.                                                     |
| VLLM_STUDIO_DAYTONA_API_KEY      | -                          | Optional API key used for routing `daytona/*` model calls.                                            |
| VLLM_STUDIO_DAYTONA_API_URL      | https://app.daytona.io/api | Optional Daytona API base URL override.                                                               |
| VLLM_STUDIO_DAYTONA_PROXY_URL    | derived from API URL       | Optional Daytona toolbox proxy URL override.                                                          |
| VLLM_STUDIO_DAYTONA_SANDBOX_ID   | -                          | Optional fixed sandbox ID for all Daytona-backed agent/file operations.                               |
| VLLM_STUDIO_DAYTONA_AGENT_MODE   | true                       | Enables Daytona-backed agent tools/files; disables MCP tool injection when Daytona key is configured. |
| VLLM_STUDIO_VERSION              | dev                        | Version label surfaced in /studio payloads.                                                           |
| TEMPORAL_ADDRESS                 | localhost:7233             | Temporal server address.                                                                              |

## Runtime backends and lifecycle

| Variable                         | Default | Purpose                                                      |
| -------------------------------- | ------- | ------------------------------------------------------------ |
| VLLM_STUDIO_RUNTIME_BIN          | -       | Override directory for runtime binaries (MCP + shell tools). |
| VLLM_STUDIO_RUNTIME_MCP          | -       | Override directory for MCP runtime files.                    |
| VLLM_STUDIO_RUNTIME_PYTHON       | -       | Override vLLM Python path.                                   |
| VLLM_STUDIO_SGLANG_PYTHON        | -       | Override sglang Python path.                                 |
| VLLM_STUDIO_TABBY_API_DIR        | -       | Tabby API directory override.                                |
| VLLM_STUDIO_LLAMA_BIN            | -       | Custom llama.cpp binary path.                                |
| VLLM_STUDIO_EXLLAMAV3_COMMAND    | -       | ExLLaMA v3 command override.                                 |
| VLLM_STUDIO_GPU_SMI_TOOL         | -       | Force GPU SMI tool (nvidia-smi, amd-smi, rocm-smi).          |
| VLLM_STUDIO_ROCM_VERSION_FILE    | -       | Override ROCm version file path.                             |
| VLLM_STUDIO_LLAMACPP_UPGRADE_CMD | -       | llama.cpp upgrade command.                                   |
| VLLM_STUDIO_SGLANG_UPGRADE_CMD   | -       | sglang upgrade command.                                      |
| VLLM_STUDIO_VLLM_UPGRADE_CMD     | -       | vLLM upgrade command.                                        |
| VLLM_STUDIO_CUDA_UPGRADE_CMD     | -       | CUDA upgrade command.                                        |
| VLLM_STUDIO_ROCM_UPGRADE_CMD     | -       | ROCm upgrade command.                                        |
| VLLM_STUDIO_VLLM_UPGRADE_VERSION | -       | Target vLLM version for upgrades.                            |

## Audio and voice

| Variable                | Default                | Purpose                                                   |
| ----------------------- | ---------------------- | --------------------------------------------------------- |
| VLLM_STUDIO_STT_BACKEND | whispercpp             | STT backend selection.                                    |
| VLLM_STUDIO_STT_CLI     | -                      | Path to STT CLI binary.                                   |
| VLLM_STUDIO_STT_MODEL   | -                      | Default STT model.                                        |
| VLLM_STUDIO_TTS_BACKEND | piper                  | TTS backend selection.                                    |
| VLLM_STUDIO_TTS_CLI     | -                      | Path to TTS CLI binary.                                   |
| VLLM_STUDIO_TTS_MODEL   | -                      | Default TTS model.                                        |
| VLLM_STUDIO_FFMPEG_CLI  | ffmpeg                 | ffmpeg binary path for audio processing.                  |
| VOICE_URL               | -                      | Default voice server URL (frontend settings).             |
| NEXT_PUBLIC_VOICE_URL   | -                      | Client-exposed voice server URL.                          |
| VOICE_MODEL             | whisper-large-v3-turbo | Default voice model (frontend settings).                  |
| NEXT_PUBLIC_VOICE_MODEL | whisper-large-v3-turbo | Client-exposed voice model.                               |
| VLLM_STUDIO_MOCK_VOICE  | -                      | When set to 1, frontend returns deterministic mock audio. |

## Downloads and integrations

| Variable             | Default   | Purpose                                                |
| -------------------- | --------- | ------------------------------------------------------ |
| VLLM_STUDIO_HF_TOKEN | -         | Hugging Face token for model downloads.                |
| EXA_API_KEY          | -         | Exa API key for MCP search integration.                |
| LITELLM_MASTER_KEY   | sk-master | LiteLLM master key (also used by controller to proxy). |

## Logging and diagnostics

| Variable                        | Default    | Purpose                |
| ------------------------------- | ---------- | ---------------------- |
| VLLM_STUDIO_LOG_LEVEL           | -          | Log level override.    |
| VLLM_STUDIO_LOG_RETENTION_DAYS  | 30         | Log retention in days. |
| VLLM_STUDIO_LOG_MAX_FILES       | 200        | Max log files.         |
| VLLM_STUDIO_LOG_MAX_TOTAL_BYTES | 1000000000 | Max log storage size.  |

## Mocking and testing

| Variable                   | Default               | Purpose                             |
| -------------------------- | --------------------- | ----------------------------------- |
| VLLM_STUDIO_MOCK_INFERENCE | -                     | Enable mock inference responses.    |
| VLLM_STUDIO_MOCK_MODEL_ID  | -                     | Mock model id returned by /models.  |
| PLAYWRIGHT_BACKEND_URL     | http://localhost:8080 | Frontend Playwright tests override. |

## Frontend runtime

| Variable                        | Default | Purpose                                   |
| ------------------------------- | ------- | ----------------------------------------- |
| BACKEND_URL                     | -       | Server-side controller base URL.          |
| NEXT_PUBLIC_BACKEND_URL         | -       | Client-visible controller base URL.       |
| NEXT_PUBLIC_API_URL             | -       | Default backend URL in settings UI.       |
| VLLM_STUDIO_BACKEND_URL         | -       | Alternative controller base URL.          |
| API_KEY                         | -       | Default API key for frontend settings.    |
| NEXT_PUBLIC_VLLM_STUDIO_API_KEY | -       | Client-visible API key.                   |
| VLLM_STUDIO_API_KEY             | -       | Server-side API key fallback.             |
| VLLM_STUDIO_DATA_DIR            | -       | Frontend settings storage base directory. |

## CLI

| Variable        | Default               | Purpose                               |
| --------------- | --------------------- | ------------------------------------- |
| VLLM_STUDIO_URL | http://localhost:8080 | Controller base URL for CLI requests. |

## Controller daemon scripts (`scripts/daemon-*.sh`)

| Variable             | Default               | Purpose          |
| -------------------- | --------------------- | ---------------- |
| VLLM_STUDIO_PID_FILE | ./data/controller.pid | PID file path.   |
| VLLM_STUDIO_LOG_FILE | ./data/controller.log | Log file path.   |
| VLLM_STUDIO_BUN_BIN  | $HOME/.bun/bin/bun    | Bun binary path. |

## Docker compose services

| Variable                                  | Default                                      | Purpose                                       |
| ----------------------------------------- | -------------------------------------------- | --------------------------------------------- |
| POSTGRES_USER                             | postgres                                     | Postgres user for LiteLLM usage DB.           |
| POSTGRES_PASSWORD                         | postgres                                     | Postgres password.                            |
| POSTGRES_DB                               | litellm                                      | Postgres database name.                       |
| INFERENCE_API_BASE                        | http://host.docker.internal:8000/v1          | LiteLLM inference endpoint.                   |
| INFERENCE_API_KEY                         | sk-placeholder                               | LiteLLM inference API key.                    |
| GF_SECURITY_ADMIN_USER                    | admin                                        | Grafana admin username.                       |
| GF_SECURITY_ADMIN_PASSWORD                | admin                                        | Grafana admin password.                       |
| GF_AUTH_ANONYMOUS_ENABLED                 | true                                         | Enable anonymous Grafana access.              |
| GF_AUTH_ANONYMOUS_ORG_ROLE                | Viewer                                       | Grafana anonymous role.                       |
| GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH | /var/lib/grafana/dashboards/vllm-studio.json | Default Grafana dashboard.                    |
| VLLM_STUDIO_UID                           | 1000                                         | UID for controller/frontend containers.       |
| VLLM_STUDIO_GID                           | 1000                                         | GID for controller/frontend containers.       |
| LITELLM_MASTER_KEY                        | sk-master                                    | LiteLLM master key (also used by controller). |
