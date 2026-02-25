# UI Kit

This folder is the standardized visual foundation for frontend surfaces.

## Scope

- Building blocks: reusable UI primitives for panel surfaces, status badges, timeline markers, and pulse labels.
- Styles: shared tone config and class conventions.
- Themes: all primitives must consume theme variables (`--bg`, `--surface`, `--fg`, `--dim`, `--border`, `--hl1`, `--hl2`, `--hl3`, `--err`).

## Files

- `types.ts`: `UiTone` contract.
- `configs.ts`: tone mapping + required theme variables.
- `primitives.tsx`: reusable components:
  - `UiPanelSurface`
  - `UiStatusBadge`
  - `UiTimelineMarker`
  - `UiPulseLabel`

## Usage Rules

1. New UI work should prefer `@/components/ui-kit` primitives before adding ad-hoc styles.
2. Do not hardcode colors in new components; use tone config or CSS theme variables.
3. Keep feature components focused on behavior and data mapping; visual structure belongs in UI kit primitives.

## Migration Plan

1. Activity tab (completed in this rollout)
2. Chat message chrome and toolbelt status controls
3. Shared dashboard/config cards and badges
4. Remaining page-level controls and modal patterns
