#!/bin/bash
# Benchmark: faster-whisper vs parakeet-cli
# Cross-platform: uses CoreML on macOS arm64, ONNX elsewhere.
# Outputs markdown section to stdout.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURES_DIR="$REPO_DIR/fixtures/benchmark"
CLI="$REPO_DIR/src/cli.ts"

# Detect platform
OS=$(uname -s)
ARCH=$(uname -m)

if [ "$OS" = "Darwin" ]; then
  CHIP=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Unknown")
  RAM=$(system_profiler SPHardwareDataType 2>/dev/null | grep "Memory:" | awk '{print $2, $3}' || echo "Unknown")
  BACKEND="CoreML"
elif [ "$OS" = "Linux" ]; then
  CHIP=$(lscpu 2>/dev/null | grep "Model name" | sed 's/.*: *//' || echo "Unknown")
  RAM=$(free -h 2>/dev/null | awk '/Mem:/{print $2}' || echo "Unknown")
  BACKEND="ONNX"
else
  CHIP="Unknown"
  RAM="Unknown"
  BACKEND="ONNX"
fi

VERSION=$(bun run "$CLI" --version 2>/dev/null || echo "unknown")

# Install backend
bun run "$CLI" install ${BACKEND:+--$(echo "$BACKEND" | tr '[:upper:]' '[:lower:]')} 2>/dev/null || bun run "$CLI" install 2>/dev/null

# Collect files
FILES=("$FIXTURES_DIR"/*.ogg)
TOTAL_FILES=${#FILES[@]}

if [[ $TOTAL_FILES -eq 0 || ! -f "${FILES[0]}" ]]; then
  echo "ERROR: No .ogg files found in $FIXTURES_DIR" >&2
  exit 1
fi

# Setup faster-whisper
VENV_DIR=$(mktemp -d)
trap 'deactivate 2>/dev/null; rm -rf "$VENV_DIR"' EXIT
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"
pip install -q faster-whisper 2>/dev/null

# Run faster-whisper
echo "Running faster-whisper benchmark ($TOTAL_FILES files)..." >&2
WHISPER_JSON=$(python3 -c "
import sys, time, json
from faster_whisper import WhisperModel
model = WhisperModel('medium', device='cpu', compute_type='int8')
results = []
for f in sys.argv[1:]:
    start = time.time()
    segments, info = model.transcribe(f, language='ru')
    text = ' '.join(s.text.strip() for s in segments)
    elapsed = time.time() - start
    results.append({'time': round(elapsed, 1), 'text': text})
print(json.dumps(results, ensure_ascii=False))
" "${FILES[@]}")

# Run parakeet
echo "Running parakeet benchmark ($TOTAL_FILES files)..." >&2
PARAKEET_JSON=$(python3 -c "
import subprocess, time, json, sys
cli = sys.argv[1]
results = []
for f in sys.argv[2:]:
    start = time.time()
    r = subprocess.run(['bun', 'run', cli, f], capture_output=True, text=True)
    elapsed = time.time() - start
    results.append({'time': round(elapsed, 1), 'text': r.stdout.strip()})
print(json.dumps(results, ensure_ascii=False))
" "$CLI" "${FILES[@]}")

# Output markdown + JSON summary
DATE=$(date -u +%Y-%m-%d)

cat << HEADER

**Date:** $DATE
**Version:** v$VERSION
**Runner:** $OS $ARCH ($CHIP, $RAM RAM)
**Backend:** $BACKEND

| # | faster-whisper | Parakeet ($BACKEND) | faster-whisper Transcript | Parakeet Transcript |
|---|---------|----------|--------------------|---------------------|
HEADER

python3 -c "
import json, sys

whisper = json.loads(sys.argv[1])
parakeet = json.loads(sys.argv[2])

wt = pt = 0
for i, (w, p) in enumerate(zip(whisper, parakeet)):
    wt += w['time']; pt += p['time']
    print(f'| {i+1} | {w[\"time\"]}s | {p[\"time\"]}s | {w[\"text\"]} | {p[\"text\"]} |')

speedup = round(wt / pt, 1) if pt > 0 else 0
print(f'| **Total** | **{round(wt, 1)}s** | **{round(pt, 1)}s** | | |')
print()
print(f'**Parakeet is ~{speedup}x faster.**')

# Write JSON summary for regression detection
import os
summary = {'whisper_total': round(wt, 1), 'parakeet_total': round(pt, 1), 'speedup': speedup}
summary_path = os.environ.get('BENCHMARK_SUMMARY', '/tmp/benchmark-summary.json')
with open(summary_path, 'w') as f:
    json.dump(summary, f)
" "$WHISPER_JSON" "$PARAKEET_JSON"
