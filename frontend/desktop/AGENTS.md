# Desktop (Electron) Agent Notes

- Keep main process hardened: `contextIsolation=true`, `sandbox=true`, `nodeIntegration=false`.
- Never expose raw Node APIs to renderer; route through explicit IPC allowlists.
- Keep packaged runtime self-contained (embedded standalone Next server + static/public assets).
- Preserve deterministic logs in `app.getPath("userData")/logs/desktop.log` for supportability.
- Validate changes with `npm run desktop:build:main` and `npm run build` before shipping.
