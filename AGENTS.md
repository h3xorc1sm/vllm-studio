# AGENTS.md

## Sensitive Configuration

**NEVER commit sensitive data to Git.** Store these in `.env.local` (already gitignored):

```bash
# Remote deployment
REMOTE_HOST=192.168.x.x          # Production server IP
REMOTE_USER=username             # SSH username
REMOTE_PATH=/home/user/project   # Deploy path
REMOTE_URL=https://your-domain.com

# API Keys
VLLM_STUDIO_DAYTONA_API_KEY=xxx
APP_STORE_CONNECT_API_KEY=xxx    # For TestFlight uploads
```

Access these in scripts via environment variables or load them from `.env.local` in your deployment scripts.

## Deployment Targets

### Production — Remote GPU Server
- **Deploy**: `./scripts/deploy-remote.sh` (or `controller` / `frontend` / `status`)
- Controller (bun :8080) and frontend (next :3000) run natively; postgres + litellm in Docker

### Staging — Local Docker (macOS)
- **Image**: `vllm-studio-frontend`
- **Container**: `vllm-studio-staging`
- **URL**: `http://localhost:3000`
- **Build**: `docker build -f frontend/Dockerfile -t vllm-studio-frontend .` (from repo root)
- **Run**: `docker run -d --name vllm-studio-staging -p 3000:3000 -e BACKEND_URL=http://host.docker.internal:8080 vllm-studio-frontend`
- **Rebuild+restart**: `docker rm -f vllm-studio-staging && docker build -f frontend/Dockerfile -t vllm-studio-frontend . && docker run -d --name vllm-studio-staging -p 3000:3000 -e BACKEND_URL=http://host.docker.internal:8080 vllm-studio-frontend`
- The frontend runs as a **prebuilt standalone Next.js app** inside Docker (not dev mode). The Dockerfile does `npm run build` then runs `node frontend/server.js`.

## Deployment Workflow

After finishing a feature, you **MUST** complete ALL deployment steps. This is not optional.

After finishing a feature, follow this checklist:

1. **Build check**: `cd frontend && npx next build`
2. **Docker staging**: `docker rm -f vllm-studio-staging && docker build --no-cache -f frontend/Dockerfile -t vllm-studio-frontend . && docker run -d --name vllm-studio-staging -p 3000:3000 -e BACKEND_URL=http://host.docker.internal:8080 vllm-studio-frontend`
3. **Verify locally**: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` (should be 200)
4. **Remote deploy** (if needed): `./scripts/deploy-remote.sh` (syncs, builds, restarts)
5. **Verify remote**: check production URLs (see `.env.local` for REMOTE_HOST)
6. **Desktop Electron update (REQUIRED - ALWAYS DO THIS)**: `cd frontend && npm run desktop:dist`
7. **Update installed Desktop app** (REQUIRED - ALWAYS DO THIS): See [Installed Desktop App Update](#installed-desktop-app-update-required) section below
8. **iOS device sync** (required when Swift client changed): `cd swift-client && ./sync-devices.sh --ios-only`
9. **TestFlight upload** (for release candidates): `cd swift-client && bundle install && bundle exec fastlane beta` (requires App Store Connect API key env vars)

### Installed Desktop App Update (Required)

Do **not** leave the new desktop build only in `frontend/dist-desktop/`.
There must be **one canonical installed app only**:

- Canonical app: `/Applications/vLLM Studio.app`
- Canonical bundle id: `org.vllm.studio.desktop`
- Legacy duplicate to remove if present: `~/Applications/vllm-studio-mac.app`

After `desktop:dist`, update the installed app bundle in place:

```bash
# Apple Silicon
ditto "frontend/dist-desktop/mac-arm64/vLLM Studio.app" "/Applications/vLLM Studio.app"

# Intel fallback
# ditto "frontend/dist-desktop/mac/vLLM Studio.app" "/Applications/vLLM Studio.app"
```

Then enforce single-install + relaunch:

```bash
# Remove old non-canonical app if present
rm -rf "$HOME/Applications/vllm-studio-mac.app"

# Relaunch canonical app
killall "vLLM Studio" >/dev/null 2>&1 || true
open -a "vLLM Studio"
```

Verification (required):

```bash
# Must show only /Applications/vLLM Studio.app
find /Applications "$HOME/Applications" -maxdepth 1 -type d -iname "*v*llm*studio*.app"

# Must print org.vllm.studio.desktop
/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "/Applications/vLLM Studio.app/Contents/Info.plist"
```

## Agent File System (Daytona)

- File writing/reading in chat uses **Daytona sandboxes** (cloud filesystem)
- Config: `VLLM_STUDIO_DAYTONA_API_KEY`, `VLLM_STUDIO_DAYTONA_AGENT_MODE=true` in `.env`
- **Disk limit**: Daytona free tier has 30GiB total. Old stopped sandboxes accumulate and block new file operations with 403 errors.
- **If file writing breaks**: List and delete old sandboxes:
  ```
  curl -s -H "Authorization: Bearer $API_KEY" "https://app.daytona.io/api/sandbox"
  curl -X DELETE -H "Authorization: Bearer $API_KEY" "https://app.daytona.io/api/sandbox/$SANDBOX_ID"
  ```
- After cleanup, restart the controller to clear cached errors.

## Notes
- Remote server specs: AMD EPYC, 8x RTX 3090, CUDA 12.8 (see `.env.local` for host)
- rsync/scp fail due to remote shell output; deploy script uses tar+ssh pipe as workaround
- Remote `next build` may fail (turbopack + redis permissions); the deploy script builds locally and ships `.next/`
