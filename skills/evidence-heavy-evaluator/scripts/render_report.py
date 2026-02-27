#!/usr/bin/env python3
"""Render a deterministic readiness report from collected evidence artifacts."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


@dataclass
class CriterionResult:
    identifier: str
    title: str
    category: str
    status: str
    evidence: str
    recommendation: str


def read_tsv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").splitlines()
    if len(lines) < 2:
        return []
    header = lines[0].split("\t")
    rows: list[dict[str, str]] = []
    for line in lines[1:]:
        values = line.split("\t")
        row = {header[index]: values[index] if index < len(values) else "" for index in range(len(header))}
        rows.append(row)
    return rows


def metric_int(metrics: dict[str, str], key: str) -> int:
    try:
        return int(metrics.get(key, "0"))
    except ValueError:
        return 0


def signal_on(signals: dict[str, str], key: str) -> bool:
    return signals.get(key, "0") == "1"


def compute_checks(checks: list[dict[str, str]]) -> dict[str, float | int]:
    executed = [row for row in checks if row.get("status", "") not in {"NA", "SKIP"}]
    passed = [row for row in executed if row.get("status") == "0"]
    failed = [row for row in executed if row.get("status") not in {"0"}]
    skipped = [row for row in checks if row.get("status") == "SKIP"]
    not_applicable = [row for row in checks if row.get("status") == "NA"]
    pass_rate = (len(passed) / len(executed)) if executed else 0.0
    return {
        "executed": len(executed),
        "passed": len(passed),
        "failed": len(failed),
        "skipped": len(skipped),
        "not_applicable": len(not_applicable),
        "pass_rate": pass_rate,
    }


def score_categories(criteria: list[CriterionResult]) -> dict[str, dict[str, float | int]]:
    categories = sorted({criterion.category for criterion in criteria})
    summary: dict[str, dict[str, float | int]] = {}
    for category in categories:
        category_items = [item for item in criteria if item.category == category and item.status in {"pass", "fail"}]
        passed = sum(1 for item in category_items if item.status == "pass")
        total = len(category_items)
        score = (passed / total) if total else 0.0
        summary[category] = {"passed": passed, "total": total, "score": round(score, 4)}
    return summary


def make_criteria(
    metrics: dict[str, str],
    signals: dict[str, str],
    checks: list[dict[str, str]],
    context: dict[str, object],
    doc_files: set[str],
) -> list[CriterionResult]:
    check_stats = compute_checks(checks)
    execute_checks = bool(context.get("execute_checks", False))
    depth = str(context.get("depth", "deep"))

    module_docs = {
        "controller/README.md",
        "frontend/README.md",
        "cli/README.md",
        "desktop/README.md",
        "swift-client/README.md",
        "shared/README.md",
    }
    module_docs_present = len(module_docs.intersection(doc_files))

    criteria: list[CriterionResult] = []

    def add(identifier: str, title: str, category: str, passed: bool, evidence: str, recommendation: str) -> None:
        criteria.append(
            CriterionResult(
                identifier=identifier,
                title=title,
                category=category,
                status="pass" if passed else "fail",
                evidence=evidence,
                recommendation=recommendation,
            )
        )

    def add_optional(
        identifier: str,
        title: str,
        category: str,
        enabled: bool,
        passed: bool,
        evidence: str,
        recommendation: str,
    ) -> None:
        if enabled:
            add(identifier, title, category, passed, evidence, recommendation)
            return
        criteria.append(
            CriterionResult(
                identifier=identifier,
                title=title,
                category=category,
                status="not_evaluated",
                evidence=evidence,
                recommendation=recommendation,
            )
        )

    add(
        "docs-root-readme",
        "Root README exists",
        "docs",
        signal_on(signals, "root_readme"),
        f"root_readme={signals.get('root_readme', '0')}",
        "Add README.md at repo root with setup, architecture, and verification sections.",
    )
    add(
        "docs-setup-guide",
        "Setup guide exists",
        "docs",
        signal_on(signals, "setup_readme"),
        f"setup_readme={signals.get('setup_readme', '0')}",
        "Add setup/README.md with local, CI, and deployment setup paths.",
    )
    add(
        "docs-hub",
        "Docs hub index exists",
        "docs",
        signal_on(signals, "docs_index"),
        f"docs_index={signals.get('docs_index', '0')}",
        "Add docs/README.md that links module docs and runbooks.",
    )
    add(
        "docs-env-reference",
        "Environment variable reference exists",
        "docs",
        signal_on(signals, "env_reference"),
        f"env_reference={signals.get('env_reference', '0')}",
        "Add docs/environment.md describing required and optional variables.",
    )
    add(
        "docs-module-coverage",
        "Module README coverage",
        "docs",
        module_docs_present >= 4,
        f"module_readmes={module_docs_present}/6",
        "Add README.md files for major modules until at least 4/6 are documented.",
    )

    add(
        "automation-ci-workflows",
        "CI workflows configured",
        "automation",
        metric_int(metrics, "ci_workflow_count") > 0,
        f"ci_workflow_count={metric_int(metrics, 'ci_workflow_count')}",
        "Add at least one .github/workflows pipeline covering lint, test, and build.",
    )
    add(
        "automation-package-manifests",
        "Package manifests discovered",
        "automation",
        metric_int(metrics, "package_json_count") > 0,
        f"package_json_count={metric_int(metrics, 'package_json_count')}",
        "Add package manifests for executable modules and define standard scripts.",
    )
    add(
        "automation-entrypoints",
        "Runtime entrypoint scripts present",
        "automation",
        signal_on(signals, "docker_compose") or signal_on(signals, "start_sh"),
        f"docker_compose={signals.get('docker_compose', '0')}, start_sh={signals.get('start_sh', '0')}",
        "Add docker-compose.yml or start script for consistent local startup.",
    )

    scripts_available = sum(1 for row in checks if row.get("status") != "NA")
    add(
        "quality-script-coverage",
        "Quality scripts defined",
        "quality",
        scripts_available >= 3,
        f"defined_quality_scripts={scripts_available}",
        "Define lint, test, and typecheck scripts in package manifests.",
    )

    add_optional(
        "quality-checks-executed",
        "Checks executed in deep mode",
        "quality",
        enabled=depth == "deep" and execute_checks,
        passed=int(check_stats["executed"]) >= 3,
        evidence=f"executed={int(check_stats['executed'])}",
        recommendation="Run deep evaluation with --execute-checks to capture executable evidence.",
    )

    add_optional(
        "quality-check-pass-rate",
        "Check pass rate >= 70%",
        "quality",
        enabled=depth == "deep" and execute_checks and int(check_stats["executed"]) > 0,
        passed=float(check_stats["pass_rate"]) >= 0.70,
        evidence=f"pass_rate={float(check_stats['pass_rate']):.2f}",
        recommendation="Fix failing lint/test/build/typecheck commands until pass rate reaches 70% or higher.",
    )

    add(
        "operations-test-presence",
        "Test files present",
        "operations",
        metric_int(metrics, "test_files") > 0,
        f"test_files={metric_int(metrics, 'test_files')}",
        "Add tests to cover critical paths and improve release confidence.",
    )
    add(
        "operations-guidance-agents",
        "AGENTS guidance exists",
        "operations",
        signal_on(signals, "agents_md"),
        f"agents_md={signals.get('agents_md', '0')}",
        "Add AGENTS.md with repo-specific execution and verification norms.",
    )

    return criteria


def weighted_score(category_scores: dict[str, dict[str, float | int]], profile: str) -> float:
    weights = {
        "readiness": {"docs": 0.30, "automation": 0.25, "quality": 0.30, "operations": 0.15},
        "maintainability": {"docs": 0.25, "automation": 0.20, "quality": 0.40, "operations": 0.15},
        "release-readiness": {"docs": 0.15, "automation": 0.30, "quality": 0.40, "operations": 0.15},
    }
    profile_weights = weights[profile]
    weighted_total = 0.0
    applied_weight = 0.0
    for category, weight in profile_weights.items():
        category_score = float(category_scores.get(category, {}).get("score", 0.0))
        weighted_total += category_score * weight
        applied_weight += weight
    if applied_weight == 0:
        return 0.0
    return round(weighted_total / applied_weight, 4)


def render_markdown(
    context: dict[str, object],
    criteria: list[CriterionResult],
    category_scores: dict[str, dict[str, float | int]],
    check_stats: dict[str, float | int],
    overall_score: float,
    input_dir: Path,
) -> str:
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    scored = [criterion for criterion in criteria if criterion.status in {"pass", "fail"}]
    passed = sum(1 for criterion in scored if criterion.status == "pass")
    total = len(scored)

    top_actions = [criterion for criterion in criteria if criterion.status == "fail"][:5]

    lines: list[str] = []
    lines.append("# Evidence-Heavy Evaluator Report")
    lines.append("")
    lines.append(f"- Target: `{context.get('target_dir', '')}`")
    lines.append(f"- Profile: `{context.get('profile', '')}`")
    lines.append(f"- Depth: `{context.get('depth', '')}`")
    lines.append(f"- Execute checks: `{context.get('execute_checks', False)}`")
    lines.append(f"- Generated: `{generated_at}`")
    lines.append("")

    lines.append("## Score Summary")
    lines.append("")
    lines.append("| Metric | Value |")
    lines.append("| --- | --- |")
    lines.append(f"| Overall weighted score | `{overall_score:.2%}` |")
    lines.append(f"| Criteria passed | `{passed}/{total}` |")
    lines.append(f"| Checks executed | `{int(check_stats['executed'])}` |")
    lines.append(f"| Checks pass rate | `{float(check_stats['pass_rate']):.2%}` |")
    lines.append("")

    lines.append("## Category Scores")
    lines.append("")
    lines.append("| Category | Passed | Total | Score |")
    lines.append("| --- | --- | --- | --- |")
    for category in sorted(category_scores.keys()):
        cat = category_scores[category]
        lines.append(
            f"| {category} | `{int(cat['passed'])}` | `{int(cat['total'])}` | `{float(cat['score']):.2%}` |"
        )
    lines.append("")

    lines.append("## Findings")
    lines.append("")
    for criterion in criteria:
        badge = {
            "pass": "PASS",
            "fail": "FAIL",
            "not_evaluated": "N/A",
        }[criterion.status]
        lines.append(f"- [{badge}] **{criterion.title}** (`{criterion.category}`)")
        lines.append(f"  Evidence: `{criterion.evidence}`")
        lines.append(f"  Action: {criterion.recommendation}")
    lines.append("")

    lines.append("## Top Actions")
    lines.append("")
    if top_actions:
        for index, action in enumerate(top_actions, start=1):
            lines.append(f"{index}. {action.recommendation} ({action.identifier})")
    else:
        lines.append("1. No blocking actions. Keep rerunning the evaluator to maintain signal quality.")
    lines.append("")

    lines.append("## Artifacts")
    lines.append("")
    artifacts = [
        "context.json",
        "metrics.tsv",
        "signals.tsv",
        "file-inventory.txt",
        "doc-files.txt",
        "package-files.txt",
        "checks-summary.tsv",
        "readiness-scorecard.json",
        "readiness-report.md",
    ]
    for artifact in artifacts:
        lines.append(f"- `{input_dir / artifact}`")

    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Render scored readiness report from evidence artifacts")
    parser.add_argument("--input-dir", required=True, help="Input evidence directory")
    parser.add_argument("--profile", required=True, choices=["readiness", "maintainability", "release-readiness"])
    parser.add_argument("--depth", required=True, choices=["quick", "deep"])
    args = parser.parse_args()

    input_dir = Path(args.input_dir).resolve()
    context_path = input_dir / "context.json"

    context = {}
    if context_path.exists():
        context = json.loads(context_path.read_text(encoding="utf-8"))
    context["profile"] = args.profile
    context["depth"] = args.depth

    metric_rows = read_tsv(input_dir / "metrics.tsv")
    signal_rows = read_tsv(input_dir / "signals.tsv")
    checks = read_tsv(input_dir / "checks-summary.tsv")

    metrics = {row["key"]: row["value"] for row in metric_rows if "key" in row and "value" in row}
    signals = {row["key"]: row["value"] for row in signal_rows if "key" in row and "value" in row}

    doc_files_path = input_dir / "doc-files.txt"
    doc_files = set()
    if doc_files_path.exists():
        doc_files = {line.strip() for line in doc_files_path.read_text(encoding="utf-8").splitlines() if line.strip()}

    criteria = make_criteria(metrics, signals, checks, context, doc_files)
    category_scores = score_categories(criteria)
    check_stats = compute_checks(checks)

    scored_criteria = [criterion for criterion in criteria if criterion.status in {"pass", "fail"}]
    raw_score = (sum(1 for criterion in scored_criteria if criterion.status == "pass") / len(scored_criteria)) if scored_criteria else 0.0
    overall_score = weighted_score(category_scores, args.profile)

    scorecard = {
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "context": context,
        "summary": {
            "overall_weighted_score": round(overall_score, 4),
            "raw_score": round(raw_score, 4),
            "criteria_passed": sum(1 for criterion in scored_criteria if criterion.status == "pass"),
            "criteria_total": len(scored_criteria),
        },
        "checks": {
            "executed": int(check_stats["executed"]),
            "passed": int(check_stats["passed"]),
            "failed": int(check_stats["failed"]),
            "skipped": int(check_stats["skipped"]),
            "not_applicable": int(check_stats["not_applicable"]),
            "pass_rate": round(float(check_stats["pass_rate"]), 4),
        },
        "category_scores": category_scores,
        "criteria": [
            {
                "id": criterion.identifier,
                "title": criterion.title,
                "category": criterion.category,
                "status": criterion.status,
                "evidence": criterion.evidence,
                "recommendation": criterion.recommendation,
            }
            for criterion in criteria
        ],
        "artifacts": {
            "context": str(input_dir / "context.json"),
            "metrics": str(input_dir / "metrics.tsv"),
            "signals": str(input_dir / "signals.tsv"),
            "checks_summary": str(input_dir / "checks-summary.tsv"),
            "report": str(input_dir / "readiness-report.md"),
        },
    }

    scorecard_path = input_dir / "readiness-scorecard.json"
    report_path = input_dir / "readiness-report.md"
    scorecard_path.write_text(json.dumps(scorecard, indent=2) + "\n", encoding="utf-8")
    report_path.write_text(
        render_markdown(context, criteria, category_scores, check_stats, overall_score, input_dir),
        encoding="utf-8",
    )

    print(f"Wrote {scorecard_path}")
    print(f"Wrote {report_path}")


if __name__ == "__main__":
    main()
