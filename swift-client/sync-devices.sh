#!/bin/bash
# CRITICAL
# Fast local delivery pipeline: incremental build + publish to macOS + connected iOS devices.
set -euo pipefail

cd "$(dirname "$0")"

DERIVED_ROOT="${DERIVED_ROOT:-$PWD/.build/device-sync}"
MAC_INSTALL_DIR="${MAC_INSTALL_DIR:-$HOME/Applications}"
IOS_BUNDLE_ID="${IOS_BUNDLE_ID:-com.sero.vllmstudio}"
OUTPUT_ROOT="${OUTPUT_ROOT:-$PWD/test-output/device-publish}"
WATCH_INTERVAL="${WATCH_INTERVAL:-2}"

FORCE_CLEAN=false
WATCH_MODE=false
RUN_MAC=true
RUN_IOS=true
SKIP_GENERATE=false
LAUNCH_AFTER_INSTALL=true

declare -a USER_DEVICE_IDS=()
declare -a TARGET_DEVICE_IDS=()
declare -a TARGET_DEVICE_NAMES=()

usage() {
  cat <<'EOF'
Usage: ./sync-devices.sh [options] [legacy_device_udid]

Options:
  --device <udid>     Publish to a specific iOS device (repeatable).
  --ios-only          Build/publish only iOS app.
  --mac-only          Build/install only macOS app.
  --clean             Force clean build (default is incremental for speed).
  --skip-generate     Skip xcodegen even if project.yml changed.
  --no-launch         Install on iOS but do not launch app.
  --watch             Keep running; rebuild/re-publish on source changes.
  --interval <sec>    Watch polling interval in seconds (default: 2).
  -h, --help          Show this help.

Environment:
  DERIVED_ROOT, MAC_INSTALL_DIR, IOS_BUNDLE_ID, OUTPUT_ROOT, WATCH_INTERVAL
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --device)
      USER_DEVICE_IDS+=("${2:-}")
      shift 2
      ;;
    --ios-only)
      RUN_MAC=false
      shift
      ;;
    --mac-only)
      RUN_IOS=false
      shift
      ;;
    --clean)
      FORCE_CLEAN=true
      shift
      ;;
    --skip-generate)
      SKIP_GENERATE=true
      shift
      ;;
    --no-launch)
      LAUNCH_AFTER_INSTALL=false
      shift
      ;;
    --watch)
      WATCH_MODE=true
      shift
      ;;
    --interval)
      WATCH_INTERVAL="${2:-2}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      # Backward compatibility: allow positional UDID.
      USER_DEVICE_IDS+=("$1")
      shift
      ;;
  esac
done

if [[ "$RUN_MAC" == false && "$RUN_IOS" == false ]]; then
  echo "❌ Nothing to do: both --ios-only and --mac-only disabled all targets."
  exit 1
fi

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "❌ XcodeGen not installed. Run: brew install xcodegen"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ python3 is required for device discovery."
  exit 1
fi

mkdir -p "$DERIVED_ROOT" "$OUTPUT_ROOT"

project_needs_generation() {
  if [[ ! -f vllm-studio.xcodeproj/project.pbxproj ]]; then
    return 0
  fi
  if [[ project.yml -nt vllm-studio.xcodeproj/project.pbxproj ]]; then
    return 0
  fi
  return 1
}

generate_project_if_needed() {
  if [[ "$SKIP_GENERATE" == true ]]; then
    return
  fi

  if project_needs_generation; then
    echo "🔧 Regenerating Xcode project..."
    xcodegen generate >/dev/null
  fi
}

collect_connected_ios_devices() {
  local json_file
  json_file="$(mktemp)"

  if ! xcrun devicectl list devices --json-output "$json_file" >/dev/null 2>&1; then
    rm -f "$json_file"
    return 0
  fi

  python3 - "$json_file" <<'PY'
import json
import sys

path = sys.argv[1]
payload = json.load(open(path))
devices = payload.get("result", {}).get("devices", [])
for item in devices:
    hw = item.get("hardwareProperties", {})
    conn = item.get("connectionProperties", {})
    props = item.get("deviceProperties", {})
    if hw.get("platform") != "iOS":
        continue
    if hw.get("reality") != "physical":
        continue
    if conn.get("pairingState") != "paired":
        continue
    udid = hw.get("udid")
    name = props.get("name", "iPhone")
    if udid:
        print(f"{udid}\t{name}")
PY

  rm -f "$json_file"
}

resolve_target_ios_devices() {
  TARGET_DEVICE_IDS=()
  TARGET_DEVICE_NAMES=()

  if [[ "${#USER_DEVICE_IDS[@]}" -gt 0 ]]; then
    for udid in "${USER_DEVICE_IDS[@]}"; do
      [[ -z "$udid" ]] && continue
      TARGET_DEVICE_IDS+=("$udid")
      TARGET_DEVICE_NAMES+=("$udid")
    done
    return
  fi

  while IFS=$'\t' read -r udid name; do
    [[ -z "$udid" ]] && continue
    TARGET_DEVICE_IDS+=("$udid")
    TARGET_DEVICE_NAMES+=("${name:-$udid}")
  done < <(collect_connected_ios_devices)
}

build_macos() {
  local log_file="$1"
  local -a cmd=(
    xcodebuild
    -project vllm-studio.xcodeproj
    -scheme vllm-studio-mac
    -destination platform=macOS
    -derivedDataPath "$DERIVED_ROOT/macos"
  )
  if [[ "$FORCE_CLEAN" == true ]]; then
    cmd+=(clean)
  fi
  cmd+=(build)
  "${cmd[@]}" >"$log_file" 2>&1
}

build_ios() {
  local log_file="$1"
  local -a cmd=(
    xcodebuild
    -project vllm-studio.xcodeproj
    -scheme vllm-studio
    -destination generic/platform=iOS
    -configuration Debug
    -allowProvisioningUpdates
    -allowProvisioningDeviceRegistration
    -derivedDataPath "$DERIVED_ROOT/ios"
  )
  if [[ "$FORCE_CLEAN" == true ]]; then
    cmd+=(clean)
  fi
  cmd+=(build)
  "${cmd[@]}" >"$log_file" 2>&1
}

install_macos_app() {
  local app_path="$DERIVED_ROOT/macos/Build/Products/Debug/vllm-studio-mac.app"

  if [[ ! -d "$app_path" ]]; then
    echo "❌ macOS app not found at: $app_path"
    return 1
  fi

  mkdir -p "$MAC_INSTALL_DIR"
  rm -rf "$MAC_INSTALL_DIR/vllm-studio-mac.app"
  cp -R "$app_path" "$MAC_INSTALL_DIR/vllm-studio-mac.app"
  echo "✅ Installed macOS app: $MAC_INSTALL_DIR/vllm-studio-mac.app"
}

install_ios_app_on_devices() {
  local run_dir="$1"
  local app_path="$DERIVED_ROOT/ios/Build/Products/Debug-iphoneos/vllm-studio.app"
  local install_log="$run_dir/ios-install.log"

  if [[ ! -d "$app_path" ]]; then
    echo "❌ iOS app not found at: $app_path"
    return 1
  fi

  : >"$install_log"
  local failed_installs=0

  for i in "${!TARGET_DEVICE_IDS[@]}"; do
    local udid="${TARGET_DEVICE_IDS[$i]}"
    local name="${TARGET_DEVICE_NAMES[$i]}"

    echo "📲 Installing on $name ($udid)..."
    if ! xcrun devicectl device install app --device "$udid" "$app_path" >>"$install_log" 2>&1; then
      echo "❌ Install failed on $name ($udid). See: $install_log"
      failed_installs=$((failed_installs + 1))
      continue
    fi

    if [[ "$LAUNCH_AFTER_INSTALL" == true ]]; then
      xcrun devicectl device process launch --device "$udid" "$IOS_BUNDLE_ID" >>"$install_log" 2>&1 || true
    fi
  done

  if [[ "$failed_installs" -gt 0 ]]; then
    return 1
  fi

  echo "✅ Installed iOS app on ${#TARGET_DEVICE_IDS[@]} device(s)"
}

emit_summary() {
  local summary_file="$1"
  local run_label="$2"
  local mac_status="$3"
  local ios_status="$4"
  local ios_devices="$5"
  local mac_log="$6"
  local ios_log="$7"

  {
    echo "# Device publish summary"
    echo ""
    echo "- run: $run_label"
    echo "- mac build: $mac_status"
    echo "- iOS publish: $ios_status"
    echo "- iOS devices: $ios_devices"
    echo "- mac log: $mac_log"
    echo "- iOS log: $ios_log"
    echo "- timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  } >"$summary_file"
}

run_once() {
  local trigger="$1"
  local run_id
  run_id="$(date +"%Y%m%d-%H%M%S")"
  local run_dir="$OUTPUT_ROOT/$run_id-$trigger"
  local mac_log="$run_dir/macos-build.log"
  local ios_log="$run_dir/ios-build.log"
  local summary_file="$run_dir/summary.md"

  mkdir -p "$run_dir"

  echo "🚀 Publish run [$trigger] -> $run_dir"
  generate_project_if_needed

  local ios_requested=false
  if [[ "$RUN_IOS" == true ]]; then
    resolve_target_ios_devices
    if [[ "${#TARGET_DEVICE_IDS[@]}" -eq 0 ]]; then
      echo "⚠️  No paired physical iOS devices found. Skipping iOS publish."
    else
      ios_requested=true
      echo "📱 Target devices (${#TARGET_DEVICE_IDS[@]}):"
      for i in "${!TARGET_DEVICE_IDS[@]}"; do
        echo "   - ${TARGET_DEVICE_NAMES[$i]} (${TARGET_DEVICE_IDS[$i]})"
      done
    fi
  fi

  local mac_pid=""
  local ios_pid=""

  if [[ "$RUN_MAC" == true ]]; then
    echo "🖥️  Building macOS app (incremental)..."
    build_macos "$mac_log" &
    mac_pid="$!"
  fi

  if [[ "$ios_requested" == true ]]; then
    echo "📦 Building iOS app (incremental)..."
    build_ios "$ios_log" &
    ios_pid="$!"
  fi

  local mac_build_ok=true
  local ios_build_ok=true

  if [[ -n "$mac_pid" ]]; then
    if ! wait "$mac_pid"; then
      mac_build_ok=false
    fi
  fi

  if [[ -n "$ios_pid" ]]; then
    if ! wait "$ios_pid"; then
      ios_build_ok=false
    fi
  fi

  local mac_status="skipped"
  local ios_status="skipped"

  if [[ "$RUN_MAC" == true ]]; then
    if [[ "$mac_build_ok" == true ]]; then
      if install_macos_app; then
        mac_status="success"
      else
        mac_status="install_failed"
      fi
    else
      mac_status="build_failed"
      echo "❌ macOS build failed. Log: $mac_log"
      tail -n 40 "$mac_log" || true
    fi
  fi

  if [[ "$ios_requested" == true ]]; then
    if [[ "$ios_build_ok" == true ]]; then
      if install_ios_app_on_devices "$run_dir"; then
        ios_status="success"
      else
        ios_status="install_failed"
      fi
    else
      ios_status="build_failed"
      echo "❌ iOS build failed. Log: $ios_log"
      tail -n 40 "$ios_log" || true
    fi
  fi

  emit_summary \
    "$summary_file" \
    "$trigger" \
    "$mac_status" \
    "$ios_status" \
    "${#TARGET_DEVICE_IDS[@]}" \
    "$mac_log" \
    "$ios_log"

  echo "🧾 Summary: $summary_file"

  if [[ "$mac_status" == "build_failed" || "$mac_status" == "install_failed" ]]; then
    return 1
  fi
  if [[ "$ios_status" == "build_failed" || "$ios_status" == "install_failed" ]]; then
    return 1
  fi
}

compute_source_hash() {
  (
    find sources resources -type f -print0 2>/dev/null | xargs -0 stat -f "%m %N" 2>/dev/null || true
    stat -f "%m %N" project.yml 2>/dev/null || true
  ) | sort | shasum | awk '{print $1}'
}

if [[ "$WATCH_MODE" == true ]]; then
  echo "👀 Watch mode enabled (interval: ${WATCH_INTERVAL}s)"
  trap 'echo ""; echo "🛑 Watch mode stopped."; exit 0' INT TERM

  previous_hash="$(compute_source_hash)"
  run_once "initial" || true

  while true; do
    sleep "$WATCH_INTERVAL"
    current_hash="$(compute_source_hash)"
    if [[ "$current_hash" != "$previous_hash" ]]; then
      previous_hash="$current_hash"
      echo "🔁 Change detected. Rebuilding and publishing..."
      run_once "watch" || true
    fi
  done
else
  run_once "manual"
fi
