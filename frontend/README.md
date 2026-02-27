# Frontend

Next.js UI for chat, agent workflows, configuration, and controller orchestration.

## Run

```bash
npm ci
npm run dev
```

## Build

```bash
npm run build
npm run start
```

## Tests

```bash
npm run test
npm run lint
```

## Configuration

- Backend URL precedence is defined in src/lib/backend-config.ts
- API key precedence is defined in src/lib/api-key.ts
- Environment variables: ../docs/environment.md
- Settings persistence uses api-settings.json stored under a writable data directory.
