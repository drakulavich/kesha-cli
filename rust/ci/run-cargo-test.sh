#!/usr/bin/env bash
# Run `cargo test` with platform-specific env vars for espeak-ng linking
# and Kokoro-model paths. Skips the real-inference tests if the cache is empty.
# Optional $3 = extra cargo args (e.g. `--no-default-features --features onnx`
# on Windows where TTS isn't yet linkable — see #136).
set -euo pipefail

KOKORO_CACHE="${1:?usage: run-cargo-test.sh <kokoro_cache> <runner_os> [extra_cargo_args]}"
RUNNER_OS="${2:?}"
EXTRA_CARGO_ARGS="${3:-}"

cd rust

case "$RUNNER_OS" in
  macOS)
    export LIBCLANG_PATH=/Library/Developer/CommandLineTools/usr/lib
    export RUSTFLAGS="-L /opt/homebrew/lib"
    export DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib
    ;;
  Linux)
    # apt-installed libespeak-ng is discovered via pkg-config / default lib paths
    :
    ;;
  Windows)
    # LIBCLANG_PATH is set in the workflow step for bindgen. No TTS libs on
    # Windows yet — caller should pass --no-default-features --features onnx.
    :
    ;;
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

# shellcheck disable=SC2086  # deliberate word-splitting of EXTRA_CARGO_ARGS
cargo test --verbose $EXTRA_CARGO_ARGS
