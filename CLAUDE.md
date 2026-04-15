# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kesha Voice Kit is a fast multilingual voice toolkit: speech-to-text (NVIDIA Parakeet TDT 0.6B) plus audio- and text-based language detection. It runs entirely locally with no cloud dependencies.

The CLI (`kesha`, with `parakeet` as a backward-compatible alias) is a thin Bun/TypeScript wrapper around a single Rust binary, `kesha-engine`, which is downloaded from GitHub Releases during `kesha install`. The Rust engine has two build-time backends for ASR:
- **CoreML** (Apple Silicon): uses FluidAudio / Apple Neural Engine via the `fluidaudio-rs` crate. Built on `macos-14` with Xcode 16.2 and `MACOSX_DEPLOYMENT_TARGET=14.0`.
- **ONNX** (Linux / Windows / fallback): uses `ort` + the `istupakov/parakeet-tdt-0.6b-v3-onnx` models.

Language detection (`lang_id.rs`) is always ONNX (`speechbrain/lang-id-voxlingua107-ecapa`), regardless of which ASR backend is active. Text language detection uses macOS `NLLanguageRecognizer` (macOS only).

Two interfaces: the CLI and a programmatic API exported from `@drakulavich/kesha-voice-kit/core`.

## Critical Development Rules

### NEVER AUTO-DOWNLOAD MODELS OR THE ENGINE

- The engine binary and models are downloaded explicitly via `kesha install`, never on first transcription run
- If either is missing, surface an actionable error directing the user to run `kesha install`
- This is a deliberate design decision to avoid surprising multi-GB downloads

### BUN-ONLY RUNTIME FOR THE CLI

- The CLI and library run on Bun, not Node.js. Use Bun-native APIs (`Bun.spawn`, `Bun.write`, `Bun.file`, `Bun.which`)
- TypeScript is executed directly by Bun — no build step
- The engine itself is a Rust binary (`rust/`), invoked as a subprocess — not linked in-process

### RELEASE PROCESS

- Before `npm publish`, run `make smoke-test` locally against the just-downloaded engine binary and verify all tests pass
- Do NOT publish to npm if smoke tests fail
- Tag and push (`git tag vX.Y.Z && git push origin vX.Y.Z`) — CI builds all three platform binaries, smoke-tests each one, and creates a draft GitHub release
- Wait for the workflow to finish, publish the draft (`gh release edit vX.Y.Z --draft=false`), then `npm publish --access public`

### TAG NAMES ARE ONE-USE UNDER IMMUTABLE RELEASES

- GitHub's "immutable releases" feature permanently reserves a tag name as soon as the release has been published, even after the release is deleted. Attempts to re-push the same tag fail with `Cannot create ref due to creations being restricted` / `tag_name was used by an immutable release`.
- **If a release goes out broken, you cannot reuse its tag.** Bump the patch version and cut a new tag (e.g. `v1.0.1` → `v1.0.2`).
- Corollary: never tag-and-push "just to test". Dispatch the `🔨 Build Engine` workflow manually on `main` instead (it skips the release job when not triggered by a tag push).

### VERIFY BEFORE PUSHING

- Run `bun test && bunx tsc --noEmit` locally before every push
- When changing Rust code (`rust/`), run `cd rust && cargo fmt` and `cargo clippy --all-features -- -D warnings` before every commit
- When changing Rust code that touches the backend modules, also run `cd rust && cargo check --features coreml --no-default-features` — the Rust test workflow only exercises the default feature set by default, and the CoreML backend has previously rotted silently because no CI job built it
- Do NOT push broken code — fix locally first

### VERIFY BEFORE PUSHING

- Run `bun test && bunx tsc --noEmit` locally before every push
- When changing Rust code (`rust/`), run `cd rust && cargo fmt` before every commit
- Do NOT push broken code — fix locally first

### ERROR HANDLING

- Always write proper error handling with human-readable messages
- Include context: what failed, why, and what to do about it
- Never swallow errors silently or let functions return success when they failed

### BRANCH PROTECTION

- `main` branch is protected — never push directly to main
- All changes must go through pull requests
- Create a feature branch, push it, and open a PR
- CI must pass before merging

### GIT WORKTREES FOR BIG CHANGES

- Use `git worktree add` for multi-file features or refactors
- Keeps main checkout clean while iterating on a feature branch
- Use when the change touches 5+ files or runs long tasks

### DO NOT BLINDLY FORWARD CLI FLAGS TO SUBCOMMANDS

- The Bun CLI wraps `kesha-engine`. If a flag is meant for the CLI (e.g. `--coreml` selecting a backend), validate it against `kesha-engine --capabilities-json` instead of passing it through as a subprocess argument — `kesha-engine install` only accepts `--no-cache`.
- Past regression: `kesha install --coreml` forwarded `--backend=coreml` to the engine and crashed with a clap parse error. Always round-trip new flags end to end (`kesha install --coreml` on a machine without a CoreML build must fail gracefully, not crash).

### COREML BACKEND LIVES OR DIES BY ITS LINKER CONFIG

- The `coreml` feature links against the macOS Swift runtime via `fluidaudio-rs`. Three things must all be true for the released binary to run on end-user machines:
  1. `macos-14` runner with `maxim-lobanov/setup-xcode@v1` pinned to an **actually available** Xcode version (check the runner image catalog — `16.0` is not on `macos-14`, `16.2` is)
  2. `MACOSX_DEPLOYMENT_TARGET=14.0` in the build job env, so the linker treats Swift concurrency as OS-provided and does not emit `@rpath/libswift_Concurrency.dylib`
  3. `rust/build.rs` emits `cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift` under `#[cfg(feature = "coreml")]` as a belt-and-suspenders fallback
- The build-engine workflow smoke-tests every freshly built binary with `--capabilities-json` before uploading the artifact. **Never remove that step** — it is the only check that catches dyld / rpath regressions before a release ships.

## Build Commands

```bash
bun install                    # Install dependencies
make test                      # Unit + integration tests
make lint                      # Type check
make smoke-test                # Link + install + run against fixtures
make release                   # lint + test + smoke-test
make publish                   # release + npm publish
make benchmark-coreml          # CoreML vs WhisperKit (local, macOS only)
```

## Project Structure

```
kesha-voice-kit/
├── bin/
│   └── kesha.js                  # Shebang entry point (aliased as `parakeet` too)
├── src/                          # Bun/TypeScript CLI + library
│   ├── cli.ts                    # Argument parsing, install/transcribe/status commands
│   ├── lib.ts                    # Public API exported at `@drakulavich/kesha-voice-kit/core`
│   ├── engine.ts                 # Engine subprocess wrapper + `getEngineCapabilities`
│   ├── engine-install.ts         # Engine binary download from GitHub Releases
│   ├── transcribe.ts             # Thin forwarder to the engine
│   ├── log.ts, progress.ts       # Stderr progress reporting
│   ├── suggest-command.ts        # "Did you mean?" typo suggester
│   └── __tests__/                # Unit tests
├── rust/                         # kesha-engine (Rust)
│   ├── Cargo.toml                # `onnx` (default) and `coreml` features
│   ├── build.rs                  # Emits swift rpath under the `coreml` feature
│   └── src/
│       ├── main.rs               # clap CLI: transcribe / detect-lang / detect-text-lang / install
│       ├── audio.rs              # symphonia decode + rubato resample to 16kHz mono f32
│       ├── models.rs             # HF download + cache handling for ASR and lang-id models
│       ├── lang_id.rs            # ONNX speechbrain audio language detection (always built)
│       ├── text_lang.rs          # macOS NLLanguageRecognizer wrapper (macOS only)
│       ├── capabilities.rs       # `--capabilities-json` output struct
│       ├── transcribe.rs         # Backend dispatch → TranscribeBackend::transcribe(path)
│       └── backend/
│           ├── mod.rs            # `TranscribeBackend` trait (audio_path → String)
│           ├── onnx.rs           # ORT pipeline: nemo128 → encoder → decoder_joint (beam=4)
│           └── fluidaudio.rs     # fluidaudio-rs 0.1 via `transcribe_file` (coreml feature)
├── tests/
│   ├── unit/                     # bun test — TS unit tests
│   └── integration/              # bun test — E2E against the installed engine
├── scripts/
│   ├── benchmark.ts              # faster-whisper vs Kesha benchmark (CI, ubuntu)
│   └── smoke-test.ts             # Pre-release fixture verification
├── .github/workflows/
│   ├── ci.yml                    # PR CI: unit tests + integration tests + type check
│   ├── rust-test.yml             # PR CI: cargo test / fmt / clippy (runs on rust/** changes)
│   └── build-engine.yml          # Tag push OR manual dispatch; builds 3 binaries, smoke-tests, creates draft release
├── Makefile                      # Development commands
├── openclaw.plugin.json          # OpenClaw plugin manifest (configSchema + configPatch)
└── package.json                  # @drakulavich/kesha-voice-kit
```

## Architecture Overview

### Request flow

```
kesha audio.ogg
  → src/cli.ts parses args
  → src/transcribe.ts → spawn kesha-engine transcribe <path>
                     → rust: backend::create_backend() → TranscribeBackend::transcribe(path)
                         ├── coreml: fluidaudio_rs::FluidAudio::transcribe_file
                         └── onnx:   symphonia load → nemo128 → encoder → decoder_joint
  → stdout: transcript; stderr: progress/errors
```

### Rust engine — feature flags

- `default = ["onnx"]`. The `onnx` feature is a pure marker gating `backend/onnx.rs`; `ort` and `ndarray` are **unconditional dependencies** because `lang_id.rs` always uses them.
- `coreml = ["dep:fluidaudio-rs"]` — mutually exclusive with `onnx` at backend-module level: when `coreml` is on, `backend::onnx` is gated out via `#[cfg(all(feature = "onnx", not(feature = "coreml")))]`.
- `backend::create_backend` selects the right implementation at compile time. There is no runtime "CoreML-first, ONNX fallback" behavior in the binary itself — the binary has exactly one ASR backend baked in. The capability check happens in the TypeScript layer.

### Key Constants

- Decoder: 2 RNN layers, 640 hidden units (ONNX backend)
- Beam width: 4 (default)
- Min audio: 0.1s (1600 samples at 16kHz)
- ASR model source: `istupakov/parakeet-tdt-0.6b-v3-onnx` on HuggingFace
- Lang-ID model source: `drakulavich/SpeechBrain-coreml` on HuggingFace

### Public API (`./core` export)

```typescript
import { transcribe, downloadEngine, getEngineCapabilities } from "@drakulavich/kesha-voice-kit/core";

const text = await transcribe("audio.ogg");
await downloadEngine({ noCache, backend });  // "coreml" | "onnx" | undefined (auto)
const caps = await getEngineCapabilities();  // { protocolVersion, backend, features }
```

## Code Style

- **TypeScript**: Strict mode, ESNext target
- **No build step**: Bun runs `.ts` directly
- **Imports**: Use relative paths (`./engine`, not `src/engine`)
- **Progress/errors**: `console.error()` — **Success messages**: `console.log()` (stdout stays pipe-friendly for transcripts)
- **Rust**: `cargo fmt` before every commit; `cargo clippy -- -D warnings` must pass

## CI/CD

### WORKFLOW RULE: No inline scripts > 3 lines

- GitHub Actions workflow steps must not contain more than 3 lines of bash
- Extract longer logic into scripts under `.github/scripts/`
- Keep workflows declarative — scripts handle the logic

### Workflows

- `.github/workflows/ci.yml` — PRs to main. Unit tests (ubuntu/windows/macos) + integration tests (macos-14) + type check (ubuntu).
- `.github/workflows/rust-test.yml` — PRs touching `rust/**`. `cargo test` on all three OSes, `cargo fmt --check` and `cargo clippy -- -D warnings` on ubuntu. **Also runs `cargo check --features coreml --no-default-features` on macos-14** to catch backend rot.
- `.github/workflows/build-engine.yml` — triggers on tag push (`v*`) OR manual `workflow_dispatch`. Builds three platform binaries in parallel, **smoke-tests each one with `--capabilities-json`**, uploads artifacts, and (on tag push only) creates a draft GitHub release.
- `.github/workflows/benchmark.yml` — manual. Runs faster-whisper vs Kesha on ubuntu and publishes results in the workflow summary and artifacts.

### Composite Actions

- `.github/actions/setup-bun/` — setup Bun with dependency caching
- `.github/actions/install-parakeet-backend/` — install engine with cache

## Platform Requirements

- **Runtime**: Bun >= 1.3.0 (CLI only; the engine is a standalone Rust binary)
- **CoreML engine binary**: macOS 14+, Apple Silicon (arm64)
- **ONNX engine binary**: macOS, Linux, Windows (anywhere a recent glibc / msvcrt is available)
- `ffmpeg` is **no longer required** — the Rust engine uses symphonia for decode and rubato for resample
