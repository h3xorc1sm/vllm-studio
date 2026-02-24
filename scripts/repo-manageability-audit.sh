#!/usr/bin/env bash
# CRITICAL
set -euo pipefail

repo_root="${1:-$(pwd)}"
out_dir="${2:-$repo_root/work/repo-manageability-sweep}"

mkdir -p "$out_dir"

tmp_files="$(mktemp)"
trap 'rm -f "$tmp_files"' EXIT
git -C "$repo_root" ls-files > "$tmp_files"

ledger="$out_dir/file-ledger.tsv"
dir_counts="$out_dir/directory-counts.tsv"
summary="$out_dir/summary.txt"
issues="$out_dir/manageability-issues.md"

marker_type_for() {
  local path="$1"
  case "$path" in
    *.swift|*.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
      printf '%s' "// CRITICAL"
      ;;
    *.sh|*.yml|*.yaml|*.gitignore|*.env|*.toml)
      printf '%s' "# CRITICAL"
      ;;
    *.md|*.html|*.xml)
      printf '%s' "<!-- CRITICAL -->"
      ;;
    *.css)
      printf '%s' "/* CRITICAL */"
      ;;
    *)
      printf '%s' ""
      ;;
  esac
}

is_marker_exempt() {
  local path="$1"
  case "$path" in
    */package-lock.json|*/bun.lock|*.pbxproj|LICENSE)
      return 0
      ;;
  esac
  return 1
}

has_required_marker() {
  local file_path="$1"
  local expected="$2"
  local line1
  local line2
  line1="$(sed -n '1p' "$file_path" | tr -d '\r')"
  line2="$(sed -n '2p' "$file_path" | tr -d '\r')"

  if [[ "$line1" == "$expected" ]]; then
    return 0
  fi

  if [[ "$line1" == '#!'* ]] && [[ "$line2" == "$expected" ]]; then
    return 0
  fi

  return 1
}

path_is_kebabish() {
  local rel_path="$1"
  local seg
  local old_ifs="$IFS"
  IFS='/'
  for seg in $rel_path; do
    if [[ "$seg" =~ [A-Z] ]] || [[ "$seg" =~ [[:space:]] ]]; then
      IFS="$old_ifs"
      return 1
    fi
  done
  IFS="$old_ifs"
  return 0
}

printf 'path\tlines\tmarker_required\tmarker_ok\tnaming_ok\tmarker_type\tnotes\n' > "$ledger"

total=0
marker_required_count=0
marker_missing_count=0
naming_violation_count=0

while IFS= read -r rel_path; do
  total=$((total + 1))
  abs_path="$repo_root/$rel_path"

  if [[ ! -f "$abs_path" ]]; then
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
      "$rel_path" "MISSING" "n/a" "n/a" "n/a" "" "missing-on-disk" >> "$ledger"
    continue
  fi

  lines="$(wc -l < "$abs_path" | tr -d ' ')"
  marker_type="$(marker_type_for "$rel_path")"
  marker_required="no"
  marker_ok="n/a"
  notes=""

  if [[ "$lines" -gt 60 ]] && [[ -n "$marker_type" ]] && ! is_marker_exempt "$rel_path"; then
    marker_required="yes"
    marker_required_count=$((marker_required_count + 1))
    if has_required_marker "$abs_path" "$marker_type"; then
      marker_ok="yes"
    else
      marker_ok="no"
      marker_missing_count=$((marker_missing_count + 1))
      notes="missing-critical-marker"
    fi
  fi

  naming_ok="yes"
  if ! path_is_kebabish "$rel_path"; then
    naming_ok="no"
    naming_violation_count=$((naming_violation_count + 1))
    if [[ -n "$notes" ]]; then
      notes="$notes,naming-violation"
    else
      notes="naming-violation"
    fi
  fi

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$rel_path" "$lines" "$marker_required" "$marker_ok" "$naming_ok" "$marker_type" "$notes" >> "$ledger"
done < "$tmp_files"

awk -F/ '{
  if (NF == 1) {
    dir="."
  } else {
    dir=$1
    for (i=2; i<NF; i++) {
      dir=dir"/"$i
    }
  }
  counts[dir]++
} END {
  for (dir in counts) {
    printf "%s\t%d\n", dir, counts[dir]
  }
}' "$tmp_files" | sort > "$dir_counts"

overcrowded_count="$(awk -F'\t' '$2 > 20 {count++} END {print count + 0}' "$dir_counts")"
overcrowded_dirs="$(awk -F'\t' '$2 > 20 {print "- `" $1 "` (" $2 " files)"}' "$dir_counts")"

{
  printf 'tracked_files=%s\n' "$total"
  printf 'marker_required_files=%s\n' "$marker_required_count"
  printf 'missing_marker_files=%s\n' "$marker_missing_count"
  printf 'naming_violations=%s\n' "$naming_violation_count"
  printf 'overcrowded_directories=%s\n' "$overcrowded_count"
} > "$summary"

{
  echo "<!-- CRITICAL -->"
  echo "# Manageability Issues"
  echo
  echo "Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo
  echo "## Summary"
  cat "$summary"
  echo
  echo "## Directories With More Than 20 Files"
  if [[ -n "$overcrowded_dirs" ]]; then
    printf '%s\n' "$overcrowded_dirs"
  else
    echo "- None"
  fi
  echo
  echo "## Sample Missing Marker Entries"
  awk -F'\t' 'NR == 1 {next} $4 == "no" {print "- `" $1 "` (" $2 " lines)"}' "$ledger" | head -n 40
  echo
  echo "## Sample Naming Violations"
  awk -F'\t' 'NR == 1 {next} $5 == "no" {print "- `" $1 "`"}' "$ledger" | head -n 40
} > "$issues"

printf 'Audit complete. Outputs:\n- %s\n- %s\n- %s\n- %s\n' "$ledger" "$dir_counts" "$summary" "$issues"
