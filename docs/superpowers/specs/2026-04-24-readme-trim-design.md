# README Trim — Design

**Date:** 2026-04-24
**Topic:** Shrink `README.md` to essentials; push advanced/operational detail to `docs/`.

## Goal

Cut `README.md` from ~247 lines to ~100 lines while preserving the information a new visitor needs in the first 30 seconds: what Kesha is, how fast it is, how to install and transcribe, and a teaser for TTS. Everything else moves under `docs/` or into the already-existing subdirectory READMEs (`raycast/`).

## Non-goals

- Rewriting the product positioning or tagline.
- Changing published CLI behavior, flags, or examples.
- Refactoring `raycast/README.md` or `BENCHMARK.md`.
- Moving `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `NOTICES.md`, `LICENSE` (they stay at repo root).

## Target README structure (~100 lines)

1. **Hero** — logo, title, badges, tagline, 4 bullets. *Unchanged.*
2. **Quick Start** — Bun install one-liner + `kesha install` + `kesha audio.ogg`. *Kept verbatim.*
3. **CLI (Speech-to-text)** — core flags only (`--format`, `--json`, `--toon`, `--verbose`, `--lang`, `status`), multi-file `head`-style example, stdout/stderr note. One-line `--vad` mention linking to `docs/vad.md`.
4. **Text-to-speech** — 3-4 line teaser + one `kesha say` example (EN + RU auto-routing). Link to `docs/tts.md` for macOS voices, SSML, full voice list.
5. **Performance** — kept: headline, benchmark SVG, BENCHMARK.md link.
6. **What's Inside** — kept: model table.
7. **Supported languages** — compact: "25 STT languages ([list](…BENCHMARK.md#languages) or models table), 107 audio lang-id languages ([full list](huggingface…))". Drop the flag-emoji wall.
8. **Integrations** — two one-liners: OpenClaw (→ `docs/openclaw.md`), Raycast (→ `raycast/`).
9. **Programmatic API** — kept: the 4-line TypeScript snippet.
10. **Requirements / Contributing / License** — kept.

## New files under `docs/`

| File | Source material | Purpose |
|---|---|---|
| `docs/vad.md` | "Long / silence-heavy audio: `--vad`" section (~15 lines) | VAD install, auto-trigger threshold, tuning defaults, references to #128/#187. |
| `docs/tts.md` | "Text-to-Speech" + "macOS system voices" + "SSML (preview)" (~60 lines) | Voice routing, supported voices, macOS `AVSpeechSynthesizer` sidecar, SSML tag table, output formats. |
| `docs/openclaw.md` | "OpenClaw Integration" section (~20 lines) | Plugin install, config snippet, agent example, plugin management commands. |
| `docs/model-mirror.md` | "Air-gapped / corporate mirrors" section (~10 lines) | `KESHA_MODEL_MIRROR` usage, mirror layout, fallback behavior. |

Each new doc is a self-contained markdown page. The moved content is **copied verbatim** from the current README — no rewriting during this pass — so the trim is reversible and review-friendly.

## Sections dropped entirely

- **Architecture** ascii box (duplicates "What's Inside" and the hero bullet about the Rust engine).
- **Supported Audio Formats** table → collapsed to one line in "What's Inside" area: "Audio decoding via [symphonia](…) — WAV, MP3, OGG/Opus, FLAC, AAC, M4A. No ffmpeg."

## Link hygiene

- Every moved section leaves a one-line pointer in the README so nothing becomes invisible.
- Cross-links use relative paths (`docs/tts.md`, `raycast/`) so they work on GitHub and on any mirror.
- No docs page links back to the README's deep-linked anchors (those anchors go away); instead each doc is self-contained.

## Validation

Before declaring the task done:

1. **Markdown rendering** — preview the new `README.md` and each new `docs/*.md` on GitHub (or locally with a markdown viewer) to confirm tables, code fences, and image paths render.
2. **Link check** — every relative link (`docs/vad.md`, `raycast/`, `assets/benchmark.svg`, issue links) resolves.
3. **Content parity** — grep the old README for each feature keyword (`KESHA_MODEL_MIRROR`, `--vad`, `ssml`, `macos-`, `openclaw plugins`) and confirm each still appears *somewhere* in the new tree.
4. **Line count** — `wc -l README.md` ≈ 100 (± 20).

## Out of scope / deferred

- A `docs/README.md` index page — nice-to-have; can be added later if `docs/` grows beyond 4 pages.
- Reworking the tagline or the 4 hero bullets.
- Any changes to content that isn't currently in the top-level `README.md`.
