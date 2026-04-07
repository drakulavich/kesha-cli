#!/bin/bash
# Smoke test: run parakeet against benchmark fixtures and verify output.
# Usage: scripts/smoke-test.sh
# Exit code 0 if all files produce non-empty transcripts, 1 otherwise.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/../fixtures/benchmark"
FAILED=0
PASSED=0
TOTAL=0

echo "Running smoke tests against benchmark fixtures..."
echo ""

for f in "$FIXTURES_DIR"/*.ogg; do
  [ -f "$f" ] || continue
  TOTAL=$((TOTAL + 1))
  NAME=$(basename "$f")

  RESULT=$(parakeet "$f" 2>/dev/null || true)

  if [ -z "$RESULT" ]; then
    echo "  FAIL  $NAME — empty transcript"
    FAILED=$((FAILED + 1))
  else
    echo "  PASS  $NAME — ${RESULT:0:60}..."
    PASSED=$((PASSED + 1))
  fi
done

echo ""
echo "$PASSED/$TOTAL passed, $FAILED failed"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
