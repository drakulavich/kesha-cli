#!/bin/bash
# Benchmark: faster-whisper vs parakeet-cli (CoreML)
# Outputs CI section content to stdout.
# The workflow inserts this between CI-BENCHMARK-START/END markers in BENCHMARK.md.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURES_DIR="$REPO_DIR/fixtures/benchmark"

# Get system info
CHIP=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Unknown")
RAM=$(system_profiler SPHardwareDataType 2>/dev/null | grep "Memory:" | awk '{print $2, $3}' || echo "Unknown")
VERSION=$(bun run "$REPO_DIR/src/cli.ts" --version 2>/dev/null || echo "unknown")

# Ensure parakeet backend is installed
bun run "$REPO_DIR/src/cli.ts" install 2>/dev/null

# Setup faster-whisper in a temporary venv
VENV_DIR=$(mktemp -d)
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"
pip install -q faster-whisper 2>/dev/null

# Collect files
declare -a FILES
i=0
for f in "$FIXTURES_DIR"/*.ogg; do
  FILES[$i]="$f"
  ((i++)) || true
done
TOTAL_FILES=${#FILES[@]}

# Run faster-whisper benchmark
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

# Run parakeet benchmark
echo "Running parakeet benchmark ($TOTAL_FILES files)..." >&2
PARAKEET_JSON=$(python3 -c "
import subprocess, time, json, sys
results = []
for f in sys.argv[1:]:
    start = time.time()
    r = subprocess.run(['bun', 'run', '$REPO_DIR/src/cli.ts', f],
                       capture_output=True, text=True)
    elapsed = time.time() - start
    results.append({'time': round(elapsed, 1), 'text': r.stdout.strip()})
print(json.dumps(results, ensure_ascii=False))
" "${FILES[@]}")

# Cleanup venv
deactivate
rm -rf "$VENV_DIR"

# Generate CI section markdown
DATE=$(date -u +%Y-%m-%d)

cat << HEADER

**Date:** $DATE
**Version:** v$VERSION
**Runner:** GitHub Actions macos-15 ($CHIP, $RAM RAM)

| # | faster-whisper | Parakeet (CoreML) | faster-whisper Transcript | Parakeet Transcript |
|---|---------|----------|--------------------|---------------------|
HEADER

python3 -c "
import json, sys

whisper = json.loads(sys.argv[1])
parakeet = json.loads(sys.argv[2])

whisper_total = 0
parakeet_total = 0

for i, (w, p) in enumerate(zip(whisper, parakeet)):
    whisper_total += w['time']
    parakeet_total += p['time']
    print(f'| {i+1} | {w[\"time\"]}s | {p[\"time\"]}s | {w[\"text\"]} | {p[\"text\"]} |')

speedup = round(whisper_total / parakeet_total) if parakeet_total > 0 else 0
print(f'| **Total** | **{round(whisper_total, 1)}s** | **{round(parakeet_total, 1)}s** | | |')
print()
print(f'**Parakeet is ~{speedup}x faster** with CoreML on Apple Silicon.')
" "$WHISPER_JSON" "$PARAKEET_JSON"
