---
name: evidence-heavy-evaluator
description: Generate an evidence-first, read-only repository evaluation report with deterministic scoring and actionable recommendations. Use when the user asks to assess readiness, maintainability, release-readiness, documentation gaps, or engineering health and wants auditable artifacts (`json` + `markdown` + raw command logs).
---

# Evidence Heavy Evaluator

Run a deterministic repo evaluation and emit auditable artifacts in `test-output`.

## Workflow

1. Choose inputs:
- `target_dir`: repo or subdirectory to evaluate.
- `profile`: `readiness`, `maintainability`, or `release-readiness`.
- `depth`: `quick` or `deep`.
- `execute_checks`: include to run lint/test/typecheck/build evidence.

2. Collect evidence:
```bash
skills/evidence-heavy-evaluator/scripts/collect_evidence.sh \
  --target-dir <target_dir> \
  --profile <profile> \
  --depth <depth> \
  [--execute-checks]
```

3. Read outputs from `<target_dir>/test-output/evidence-heavy-evaluator/`:
- `readiness-scorecard.json`
- `readiness-report.md`
- `checks-summary.tsv`
- `metrics.tsv`
- `signals.tsv`

4. Summarize results for the user:
- Lead with highest-impact failed criteria.
- Cite the exact artifact paths used as evidence.
- Separate failed checks from skipped/not-evaluated checks.

## Guardrails

- Keep evaluation read-only: do not edit code as part of this skill.
- Treat command failures as evidence, not blockers.
- Preserve deterministic ordering in report summaries.
- If `--execute-checks` is omitted, call out that quality execution criteria are not evaluated.

## Criteria

Use `references/criteria-matrix.md` as the source of truth for scoring criteria and profile weights.

## Notes

- The collector automatically runs `render_report.py` after evidence collection.
- `uv` is required because `render_report.py` is executed with `uv run`.
