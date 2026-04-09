# CLI Help Improvements with citty

**Date**: 2026-04-09
**Status**: Approved
**Scope**: `src/cli.ts` rewrite, new `src/__tests__/cli.test.ts`, `package.json` (add citty), `README.md` (license section)

## Problem

The CLI has minimal help output (two lines), no `--help` flag, and no subcommand help. Users have no discoverability for available commands and options. Also, only one audio file can be transcribed at a time.

## Solution

Rewrite `src/cli.ts` using [citty](https://github.com/unjs/citty) to get structured help, subcommands, and flag parsing. Add multiple file transcription support.

### Target Output

`parakeet --help`:
```
parakeet v0.7.4

Fast local speech-to-text. 25 languages. CoreML on Apple Silicon, ONNX on CPU.

Usage: parakeet [command] [options]

Commands:
  install              download speech-to-text models
  help [command]       display help for command

For more info, run a command with --help:
  parakeet install --help
```

`parakeet install --help`:
```
download speech-to-text models

Usage: parakeet install [options]

Options:
  --coreml     force CoreML backend (macOS arm64)
  --onnx       force ONNX backend
  --no-cache   re-download even if cached
  -h, --help   display help for command
```

`parakeet --version` → `0.7.4`

### Multiple File Transcription

`parakeet file1.ogg file2.mp3` transcribes each file in sequence.

**Single file** — no header, just transcript (preserves current behavior, pipe-friendly):
```
Transcript text here.
```

**Multiple files** — header per file, like `head`:
```
=== file1.ogg ===
Transcript of first file.

=== file2.mp3 ===
Transcript of second file.
```

If any file fails, log the error to stderr and continue. Exit code 1 if any file failed, 0 if all succeeded.

### Architecture

- **Main command** — `defineCommand` with `meta` (name, version, description), positional `files` arg (variadic), and `run` handler for transcription
- **`install` subcommand** — `defineCommand` with `--coreml`, `--onnx`, `--no-cache` boolean args
- **`runMain()`** — provides `--help`, `--version`, and subcommand help automatically

Single file: `src/cli.ts`. No changes to `src/lib.ts` or any other source files.

### New Dependency

- `citty` — zero deps, ~15KB, ESM-native

### CLI Tests (`src/__tests__/cli.test.ts`)

Test citty command definitions by importing them:
- `--help` produces expected output (contains "Usage:", command names)
- `--version` prints version string
- `install` subcommand accepts `--coreml`, `--onnx`, `--no-cache`
- Multiple positional args are parsed correctly
- No args shows help

### README License Update

Replace current license section with:
```
## License

Made with 💛🩵 Published under MIT License.
```

## Out of Scope

- No changes to `src/lib.ts` public API
- No changes to transcription logic
- No new subcommands beyond `install`
