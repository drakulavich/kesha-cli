#!/usr/bin/env bash
# Download Kokoro model + af_heart voice for CI tests.
# Called by rust-test.yml; cache warms on subsequent runs.
set -euo pipefail

DEST="${1:?usage: download-kokoro.sh <dest_dir>}"
mkdir -p "$DEST"

if [[ ! -f "$DEST/model.onnx" ]]; then
  echo "Downloading Kokoro model.onnx..."
  curl -fL -o "$DEST/model.onnx" \
    https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model.onnx
fi

if [[ ! -f "$DEST/af_heart.bin" ]]; then
  echo "Downloading Kokoro af_heart.bin..."
  curl -fL -o "$DEST/af_heart.bin" \
    https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/af_heart.bin
fi

ls -lh "$DEST"
