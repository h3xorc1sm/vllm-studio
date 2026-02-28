#!/bin/bash
# CRITICAL
# Build + test verification script for Swift client (iOS + macOS)
set -euo pipefail

cd "$(dirname "$0")"

OUTPUT_DIR="${OUTPUT_DIR:-$PWD/test-output/verify-build}"
mkdir -p "$OUTPUT_DIR"

if ! command -v xcodegen &> /dev/null; then
  echo "❌ XcodeGen not installed. Run: brew install xcodegen"
  exit 1
fi

echo "🔧 Step 1/4: Regenerating Xcode project..."
xcodegen generate

run_build() {
  local label="$1"
  local log_file="$2"
  shift 2

  echo "🏗️  Building $label..."
  set +e
  "$@" >"$log_file" 2>&1
  local exit_code=$?
  set -e
  grep -E "^(Build|==|/Users|error:|warning:|Test)" "$log_file" || true

  local error_count
  local warning_count
  error_count=$(grep -c "error:" "$log_file" || echo "0")
  warning_count=$(grep -c "warning:" "$log_file" || echo "0")

  if [ "$exit_code" -ne 0 ]; then
    echo "❌ $label build failed"
    echo "   Errors: $error_count"
    echo "   Warnings: $warning_count"
    echo "   Full log: $log_file"
    exit "$exit_code"
  fi

  echo "✅ $label build passed (warnings: $warning_count)"
}

echo "📱 Step 2/4: Validating app targets..."
run_build \
  "iOS Simulator" \
  "$OUTPUT_DIR/build-ios.log" \
  xcodebuild \
  -project vllm-studio.xcodeproj \
  -scheme vllm-studio \
  -destination "platform=iOS Simulator,name=iPhone 15,OS=18.1" \
  clean build

run_build \
  "macOS" \
  "$OUTPUT_DIR/build-macos.log" \
  xcodebuild \
  -project vllm-studio.xcodeproj \
  -scheme vllm-studio-mac \
  -destination "platform=macOS" \
  clean build

run_tests() {
  local label="$1"
  local log_file="$2"
  shift 2

  echo "🧪 Running $label..."
  set +e
  "$@" >"$log_file" 2>&1
  local exit_code=$?
  set -e
  grep -E "^(Test|Build|==|/Users|error:|warning:)" "$log_file" || true

  local error_count
  local warning_count
  error_count=$(grep -c "error:" "$log_file" || echo "0")
  warning_count=$(grep -c "warning:" "$log_file" || echo "0")

  if [ "$exit_code" -ne 0 ]; then
    echo "❌ $label failed"
    echo "   Errors: $error_count"
    echo "   Warnings: $warning_count"
    echo "   Full log: $log_file"
    exit "$exit_code"
  fi

  echo "✅ $label passed (warnings: $warning_count)"
}

echo "🧪 Step 3/4: Running macOS unit tests..."
run_tests \
  "macOS unit tests" \
  "$OUTPUT_DIR/tests-macos.log" \
  xcodebuild \
  -project vllm-studio.xcodeproj \
  -scheme vllm-studio-mac \
  -destination "platform=macOS" \
  test

echo ""
echo "✅ Step 4/4: All Swift builds/tests succeeded"
echo "   iOS build log:   $OUTPUT_DIR/build-ios.log"
echo "   macOS build log: $OUTPUT_DIR/build-macos.log"
echo "   macOS test log:  $OUTPUT_DIR/tests-macos.log"
