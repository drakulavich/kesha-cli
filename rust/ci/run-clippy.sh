#!/usr/bin/env bash
# clippy with TTS feature and platform env so linking succeeds.
set -euo pipefail

RUNNER_OS="${1:?usage: run-clippy.sh <runner_os>}"

cd rust

case "$RUNNER_OS" in
  Linux)
    :
    ;;
  macOS)
    export LIBCLANG_PATH=/Library/Developer/CommandLineTools/usr/lib
    export RUSTFLAGS="-L /opt/homebrew/lib"
    ;;
esac

cargo clippy --all-targets -- -D warnings
