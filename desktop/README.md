# Desktop

Shell helpers for running the controller as a background daemon.

## Usage

```bash
./daemon-start.sh
./daemon-status.sh
./daemon-stop.sh
```

## Configuration

- VLLM_STUDIO_PID_FILE: PID file path (default ./data/controller.pid)
- VLLM_STUDIO_LOG_FILE: Log file path (default ./data/controller.log)
- VLLM_STUDIO_BUN_BIN: Bun binary path (default $HOME/.bun/bin/bun)
