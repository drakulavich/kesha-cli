# Rewrite scripts/ to TypeScript + CI workflow changes

## Goal

Replace bash scripts in `scripts/` with TypeScript running on Bun. Make `test-reports.yml` self-contained (runs its own tests). Move CI to PR-only.

## Changes

### 1. `scripts/smoke-test.ts` (replaces `smoke-test.sh`)

Runs `parakeet` against each `fixtures/benchmark/*.ogg` file via `Bun.spawn`. Prints PASS/FAIL per file, exits 1 if any failed.

### 2. `scripts/benchmark.ts` (replaces `benchmark.sh`)

Three phases:
1. **System detection** — `process.platform`, `process.arch`, `Bun.spawnSync` for `lscpu`/`sysctl`/`system_profiler`
2. **faster-whisper** — `Bun.spawn(["python3", "-c", ...])` with inline Python. Creates venv, installs faster-whisper, runs benchmark, outputs JSON to stdout.
3. **Parakeet** — `Bun.spawn(["bun", "run", "src/cli.ts", file])` per fixture, measures time.

Output: markdown to stdout, `benchmark-summary.json` to env-specified path.

### 3. `test-reports.yml` — self-contained

Triggers on `push to main`. Runs tests directly (no artifact download):

```
- checkout (LFS)
- setup bun
- bun install
- install parakeet backend
- install ffmpeg
- bun test --reporter=junit --reporter-outfile=allure-results/all.xml
- bunx allure generate
- load history (load-allure-history.ts)
- publish to gh-pages
```

Remove `workflow_run` trigger and all artifact download steps.

### 4. `ci.yml` — PR only

Remove `push: branches: [main]` trigger. Keep `pull_request: branches: [main]` only. Tests already passed in PR, no need to re-run on merge to main.

### 5. Cleanup

- Delete `scripts/benchmark.sh`
- Delete `scripts/smoke-test.sh`
- Update `Makefile`: `bash scripts/smoke-test.sh` → `bun scripts/smoke-test.ts`

## Files

| Action | File |
|--------|------|
| Create | `scripts/smoke-test.ts` |
| Create | `scripts/benchmark.ts` |
| Delete | `scripts/smoke-test.sh` |
| Delete | `scripts/benchmark.sh` |
| Modify | `.github/workflows/test-reports.yml` |
| Modify | `.github/workflows/ci.yml` |
| Modify | `Makefile` |
