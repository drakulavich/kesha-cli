#!/usr/bin/env bash
# Run `cargo test` with Kokoro-model env vars pointing at the workflow's
# cached spike assets. Skips the real-inference tests if the cache is empty.
set -euo pipefail

KOKORO_CACHE="${1:?usage: run-cargo-test.sh <kokoro_cache> <runner_os>}"
RUNNER_OS="${2:?}"

cd rust

case "$RUNNER_OS" in
  macOS|Linux|Windows) ;;
  *)
    echo "unsupported runner: $RUNNER_OS" >&2
    exit 1
    ;;
esac

if [[ -f "$KOKORO_CACHE/model.onnx" && -f "$KOKORO_CACHE/af_heart.bin" ]]; then
  export KOKORO_MODEL="$KOKORO_CACHE/model.onnx"
  export KOKORO_VOICE="$KOKORO_CACHE/af_heart.bin"
  echo "Running with real Kokoro models from $KOKORO_CACHE"
else
  echo "Kokoro cache empty — gated tests will skip"
fi

cargo test --verbose
