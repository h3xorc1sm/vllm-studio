# Criteria Matrix

This file defines the scoring surface for `$evidence-heavy-evaluator`.

## Categories

- `docs`
- `automation`
- `quality`
- `operations`

## Scored Criteria

| ID | Category | Pass Condition | Evidence Source |
| --- | --- | --- | --- |
| docs-root-readme | docs | `README.md` exists | `signals.tsv` |
| docs-setup-guide | docs | `setup/README.md` exists | `signals.tsv` |
| docs-hub | docs | `docs/README.md` exists | `signals.tsv` |
| docs-env-reference | docs | `docs/environment.md` exists | `signals.tsv` |
| docs-module-coverage | docs | At least 4 of 6 module READMEs exist | `doc-files.txt` |
| automation-ci-workflows | automation | At least 1 workflow file exists | `metrics.tsv` |
| automation-package-manifests | automation | At least 1 `package.json` exists | `metrics.tsv` |
| automation-entrypoints | automation | `docker-compose.yml` or `start.sh` exists | `signals.tsv` |
| quality-script-coverage | quality | At least 3 quality scripts are defined | `checks-summary.tsv` |
| quality-checks-executed | quality | Deep mode + executed checks with at least 3 runs | `context.json`, `checks-summary.tsv` |
| quality-check-pass-rate | quality | Pass rate >= 70% for executed checks | `checks-summary.tsv` |
| operations-test-presence | operations | At least 1 test file exists | `metrics.tsv` |
| operations-guidance-agents | operations | `AGENTS.md` exists | `signals.tsv` |

## Profile Weights

| Profile | docs | automation | quality | operations |
| --- | --- | --- | --- | --- |
| readiness | 0.30 | 0.25 | 0.30 | 0.15 |
| maintainability | 0.25 | 0.20 | 0.40 | 0.15 |
| release-readiness | 0.15 | 0.30 | 0.40 | 0.15 |

## Output Artifacts

- `context.json`
- `metrics.tsv`
- `signals.tsv`
- `file-inventory.txt`
- `doc-files.txt`
- `package-files.txt`
- `checks-summary.tsv`
- `readiness-scorecard.json`
- `readiness-report.md`
