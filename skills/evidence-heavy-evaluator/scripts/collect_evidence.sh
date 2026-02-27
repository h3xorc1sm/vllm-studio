#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="."
OUTPUT_DIR=""
PROFILE="readiness"
DEPTH="deep"
EXECUTE_CHECKS="false"

usage() {
  cat <<'USAGE'
Usage:
  collect_evidence.sh [options]

Options:
  --target-dir <path>      Repo or directory to evaluate (default: .)
  --output-dir <path>      Output directory (default: <target>/test-output/evidence-heavy-evaluator)
  --profile <name>         readiness | maintainability | release-readiness (default: readiness)
  --depth <name>           quick | deep (default: deep)
  --execute-checks         Run discovered lint/test/typecheck/build scripts
  --help                   Show this message
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-dir)
      TARGET_DIR="$2"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --depth)
      DEPTH="$2"
      shift 2
      ;;
    --execute-checks)
      EXECUTE_CHECKS="true"
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

case "$PROFILE" in
  readiness|maintainability|release-readiness) ;;
  *)
    echo "Invalid --profile: $PROFILE" >&2
    exit 1
    ;;
esac

case "$DEPTH" in
  quick|deep) ;;
  *)
    echo "Invalid --depth: $DEPTH" >&2
    exit 1
    ;;
esac

TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
if [[ -z "$OUTPUT_DIR" ]]; then
  OUTPUT_DIR="$TARGET_DIR/test-output/evidence-heavy-evaluator"
fi
OUTPUT_DIR="$(mkdir -p "$OUTPUT_DIR" && cd "$OUTPUT_DIR" && pwd)"
mkdir -p "$OUTPUT_DIR/checks"

TIMESTAMP_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

add_metric() {
  printf "%s\t%s\n" "$1" "$2" >> "$OUTPUT_DIR/metrics.tsv"
}

add_signal() {
  printf "%s\t%s\n" "$1" "$2" >> "$OUTPUT_DIR/signals.tsv"
}

has_file() {
  local relative_path="$1"
  if [[ -f "$TARGET_DIR/$relative_path" ]]; then
    echo "1"
  else
    echo "0"
  fi
}

find_files() {
  (
    cd "$TARGET_DIR"
    rg --files -uu \
      --glob '!**/node_modules/**' \
      --glob '!**/.git/**' \
      --glob '!**/.opencode/**' \
      --glob '!**/.claude/**' \
      --glob '!**/.ralph/**' \
      --glob '!**/.codex/**' \
      --glob '!**/.next/**' \
      --glob '!**/dist/**' \
      --glob '!**/build/**'
  )
}

count_matching() {
  local pattern="$1"
  (
    cd "$TARGET_DIR"
    rg --files -uu \
      --glob '!**/node_modules/**' \
      --glob '!**/.git/**' \
      --glob '!**/.opencode/**' \
      --glob '!**/.claude/**' \
      --glob '!**/.ralph/**' \
      --glob '!**/.codex/**' \
      --glob '!**/.next/**' \
      --glob '!**/dist/**' \
      --glob '!**/build/**' \
      -g "$pattern" | wc -l | tr -d ' '
  )
}

script_defined() {
  local package_json="$1"
  local script_name="$2"
  if [[ ! -f "$package_json" ]]; then
    return 1
  fi
  rg -q "\"$script_name\"\\s*:" "$package_json" 2>/dev/null
}

detect_runner() {
  local package_dir="$1"
  if [[ -f "$package_dir/bun.lock" || -f "$package_dir/bun.lockb" ]]; then
    echo "bun"
    return
  fi
  if [[ -f "$package_dir/pnpm-lock.yaml" ]]; then
    echo "pnpm"
    return
  fi
  if [[ -f "$package_dir/yarn.lock" ]]; then
    echo "yarn"
    return
  fi
  echo "npm"
}

run_check() {
  local package_dir="$1"
  local runner="$2"
  local script_name="$3"
  local safe_dir
  local log_path
  local status

  safe_dir="$(echo "$package_dir" | tr '/ ' '__')"
  log_path="$OUTPUT_DIR/checks/${safe_dir}__${script_name}.txt"

  if [[ "$EXECUTE_CHECKS" != "true" || "$DEPTH" != "deep" ]]; then
    printf "%s\t%s\t%s\tSKIP\t%s\n" "$package_dir" "$runner" "$script_name" "$log_path" >> "$OUTPUT_DIR/checks-summary.tsv"
    return
  fi

  set +e
  (
    cd "$package_dir"
    case "$runner" in
      bun)
        bun run "$script_name"
        ;;
      pnpm)
        pnpm run "$script_name"
        ;;
      yarn)
        yarn run "$script_name"
        ;;
      npm)
        npm run "$script_name"
        ;;
      *)
        echo "Unsupported runner: $runner"
        exit 2
        ;;
    esac
  ) >"$log_path" 2>&1
  status=$?
  set -e

  printf "%s\t%s\t%s\t%s\t%s\n" "$package_dir" "$runner" "$script_name" "$status" "$log_path" >> "$OUTPUT_DIR/checks-summary.tsv"
}

printf "key\tvalue\n" > "$OUTPUT_DIR/metrics.tsv"
printf "key\tvalue\n" > "$OUTPUT_DIR/signals.tsv"
printf "package_dir\trunner\tscript\tstatus\tlog\n" > "$OUTPUT_DIR/checks-summary.tsv"

cat > "$OUTPUT_DIR/context.json" <<CONTEXT
{
  "timestamp_utc": "$TIMESTAMP_UTC",
  "target_dir": "$TARGET_DIR",
  "output_dir": "$OUTPUT_DIR",
  "profile": "$PROFILE",
  "depth": "$DEPTH",
  "execute_checks": $([[ "$EXECUTE_CHECKS" == "true" ]] && echo "true" || echo "false")
}
CONTEXT

find_files > "$OUTPUT_DIR/file-inventory.txt"
add_metric "total_files" "$(wc -l < "$OUTPUT_DIR/file-inventory.txt" | tr -d ' ')"
add_metric "markdown_files" "$(count_matching '*.md')"
add_metric "typescript_files" "$(count_matching '*.ts')"
add_metric "tsx_files" "$(count_matching '*.tsx')"
add_metric "python_files" "$(count_matching '*.py')"
add_metric "shell_files" "$(count_matching '*.sh')"
add_metric "test_files" "$(count_matching '*test*')"

(
  cd "$TARGET_DIR"
  rg --files -uu \
    --glob '!**/node_modules/**' \
    --glob '!**/.git/**' \
    --glob '!**/.opencode/**' \
    --glob '!**/.claude/**' \
    --glob '!**/.ralph/**' \
    --glob '!**/.codex/**' \
    --glob '!**/.next/**' \
    -g '*.md' -g '*.mdx' -g 'README*'
) > "$OUTPUT_DIR/doc-files.txt"
add_metric "doc_file_count" "$(wc -l < "$OUTPUT_DIR/doc-files.txt" | tr -d ' ')"

(
  cd "$TARGET_DIR"
  rg --files -uu \
    --glob '!**/node_modules/**' \
    --glob '!**/.git/**' \
    --glob '!**/.opencode/**' \
    --glob '!**/.claude/**' \
    --glob '!**/.ralph/**' \
    --glob '!**/.codex/**' \
    --glob '!**/.next/**' \
    -g 'package.json' \
    | rg -v -e '(^\.|/\.)'
) > "$OUTPUT_DIR/package-files.txt"
add_metric "package_json_count" "$(wc -l < "$OUTPUT_DIR/package-files.txt" | tr -d ' ')"

add_signal "root_readme" "$(has_file 'README.md')"
add_signal "setup_readme" "$(has_file 'setup/README.md')"
add_signal "docs_index" "$(has_file 'docs/README.md')"
add_signal "agents_md" "$(has_file 'AGENTS.md')"
add_signal "docker_compose" "$(has_file 'docker-compose.yml')"
add_signal "start_sh" "$(has_file 'start.sh')"
add_signal "env_reference" "$(has_file 'docs/environment.md')"

if [[ -d "$TARGET_DIR/.github/workflows" ]]; then
  workflow_count="$(find "$TARGET_DIR/.github/workflows" -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) | wc -l | tr -d ' ')"
else
  workflow_count="0"
fi
add_metric "ci_workflow_count" "$workflow_count"

while IFS= read -r package_file; do
  [[ -z "$package_file" ]] && continue
  [[ "$package_file" == .* || "$package_file" == */.* ]] && continue
  package_dir="$TARGET_DIR/$(dirname "$package_file")"
  [[ ! -f "$TARGET_DIR/$package_file" ]] && continue
  [[ ! -d "$package_dir" ]] && continue
  runner="$(detect_runner "$package_dir")"

  for script_name in lint typecheck test build check; do
    if script_defined "$TARGET_DIR/$package_file" "$script_name"; then
      run_check "$package_dir" "$runner" "$script_name"
    else
      printf "%s\t%s\t%s\tNA\tNA\n" "$package_dir" "$runner" "$script_name" >> "$OUTPUT_DIR/checks-summary.tsv"
    fi
  done
done < "$OUTPUT_DIR/package-files.txt"

if command -v uv >/dev/null 2>&1; then
  uv run "$TARGET_DIR/skills/evidence-heavy-evaluator/scripts/render_report.py" \
    --input-dir "$OUTPUT_DIR" \
    --profile "$PROFILE" \
    --depth "$DEPTH"
else
  echo "uv is required to run render_report.py" >&2
  exit 1
fi

echo "Evidence collection complete: $OUTPUT_DIR"
