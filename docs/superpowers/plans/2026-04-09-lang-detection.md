# Language Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add post-transcription language detection via tinyld, a `--lang` flag for validation, and `lang` field in JSON output.

**Architecture:** After `transcribe()` returns text, call `tinyld.detect(text)` to identify the language. Add the result to `TranscribeResult`. If `--lang` is provided and doesn't match, warn to stderr. JSON output includes `lang` field.

**Tech Stack:** tinyld (language detection), citty (CLI), Bun, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-09-lang-detection-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | Add tinyld dependency |
| `src/cli.ts` | Add `--lang` flag, detect language, warn on mismatch, add `lang` to TranscribeResult + JSON |
| `src/__tests__/cli.test.ts` | Tests for language detection, mismatch warning, JSON lang field |

---

### Task 1: Add tinyld dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install tinyld**

```bash
bun add tinyld
```

- [ ] **Step 2: Verify installation**

```bash
bun --eval "import { detect } from 'tinyld'; console.log(detect('This is English text'))"
```

Expected: `en`

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add tinyld language detection dependency"
```

---

### Task 2: Add language detection and `--lang` flag

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/__tests__/cli.test.ts`

- [ ] **Step 1: Write failing tests for language detection**

Add to `src/__tests__/cli.test.ts`:

```typescript
import { detectLanguage, checkLanguageMismatch } from "../cli";

describe("language detection", () => {
  test("detects English text", () => {
    const lang = detectLanguage("This is a simple English sentence for testing.");
    expect(lang).toBe("en");
  });

  test("detects Russian text", () => {
    const lang = detectLanguage("Это простое предложение на русском языке для тестирования.");
    expect(lang).toBe("ru");
  });

  test("returns empty string for empty text", () => {
    const lang = detectLanguage("");
    expect(lang).toBe("");
  });

  test("checkLanguageMismatch returns null when no expected lang", () => {
    const warning = checkLanguageMismatch(undefined, "en");
    expect(warning).toBeNull();
  });

  test("checkLanguageMismatch returns null when languages match", () => {
    const warning = checkLanguageMismatch("en", "en");
    expect(warning).toBeNull();
  });

  test("checkLanguageMismatch returns warning when languages differ", () => {
    const warning = checkLanguageMismatch("ru", "en");
    expect(warning).toContain("expected language");
    expect(warning).toContain("ru");
    expect(warning).toContain("en");
  });

  test("checkLanguageMismatch returns null when detected is empty", () => {
    const warning = checkLanguageMismatch("en", "");
    expect(warning).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/__tests__/cli.test.ts`
Expected: FAIL — `detectLanguage` and `checkLanguageMismatch` are not exported

- [ ] **Step 3: Implement detectLanguage and checkLanguageMismatch**

Add to `src/cli.ts`, before the `TranscribeResult` type:

```typescript
import { detect } from "tinyld";

export function detectLanguage(text: string): string {
  if (!text) return "";
  return detect(text);
}

export function checkLanguageMismatch(expected: string | undefined, detected: string): string | null {
  if (!expected || !detected || expected === detected) return null;
  return `warning: expected language "${expected}" but detected "${detected}"`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/__tests__/cli.test.ts`
Expected: PASS — all language detection tests green

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts src/__tests__/cli.test.ts
git commit -m "feat: add detectLanguage and checkLanguageMismatch helpers"
```

---

### Task 3: Wire language into CLI and JSON output

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/__tests__/cli.test.ts`

- [ ] **Step 1: Write failing tests for JSON lang field and --lang flag**

Add to `src/__tests__/cli.test.ts`:

```typescript
describe("output formatting with lang", () => {
  test("JSON output includes lang field", () => {
    const output = formatJsonOutput([{ file: "a.ogg", text: "Hello world", lang: "en" }]);
    const parsed = JSON.parse(output);
    expect(parsed[0].lang).toBe("en");
  });

  test("JSON output includes empty lang when not detected", () => {
    const output = formatJsonOutput([{ file: "a.ogg", text: "", lang: "" }]);
    const parsed = JSON.parse(output);
    expect(parsed[0].lang).toBe("");
  });
});

describe("CLI help", () => {
  test("main help contains --lang flag", async () => {
    const usage = await renderUsage(mainCommand);
    expect(usage).toContain("--lang");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/__tests__/cli.test.ts`
Expected: FAIL — `TranscribeResult` doesn't have `lang`, `--lang` not in help

- [ ] **Step 3: Update TranscribeResult type and formatting**

In `src/cli.ts`, update the `TranscribeResult` type:

```typescript
export type TranscribeResult = { file: string; text: string; lang: string };
```

Update all existing places that create `TranscribeResult` objects. In the `mainCommand.run` handler, replace the transcription loop:

```typescript
    for (const file of files) {
      try {
        const text = await transcribe(file);
        const lang = detectLanguage(text);

        const mismatchWarning = checkLanguageMismatch(args.lang, lang);
        if (mismatchWarning) log.warn(mismatchWarning);

        results.push({ file, text, lang });
      } catch (err: unknown) {
        hasError = true;
        const message = err instanceof Error ? err.message : String(err);
        log.error(`${file}: ${message}`);
      }
    }
```

Add `--lang` to `mainCommand.args`:

```typescript
  args: {
    json: {
      type: "boolean",
      description: "Output results as JSON",
      default: false,
    },
    lang: {
      type: "string",
      description: "Expected language code (ISO 639-1), warn if mismatch",
    },
  },
```

- [ ] **Step 4: Update existing tests that create TranscribeResult**

Update the existing output formatting tests to include `lang`:

```typescript
describe("output formatting", () => {
  test("single file text: no header", () => {
    const output = formatTextOutput([{ file: "a.ogg", text: "Hello", lang: "en" }]);
    expect(output).toBe("Hello\n");
  });

  test("multiple files text: headers per file", () => {
    const output = formatTextOutput([
      { file: "a.ogg", text: "Hello", lang: "en" },
      { file: "b.mp3", text: "World", lang: "en" },
    ]);
    expect(output).toBe("=== a.ogg ===\nHello\n\n=== b.mp3 ===\nWorld\n");
  });

  test("JSON output: always array, pretty-printed", () => {
    const output = formatJsonOutput([{ file: "a.ogg", text: "Hello", lang: "en" }]);
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toEqual([{ file: "a.ogg", text: "Hello", lang: "en" }]);
    expect(output).toContain("\n");
  });

  test("JSON output: multiple files", () => {
    const output = formatJsonOutput([
      { file: "a.ogg", text: "Hello", lang: "en" },
      { file: "b.mp3", text: "World", lang: "en" },
    ]);
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].file).toBe("a.ogg");
    expect(parsed[1].file).toBe("b.mp3");
  });

  test("JSON output: empty array when no results", () => {
    const output = formatJsonOutput([]);
    expect(JSON.parse(output)).toEqual([]);
  });
});
```

- [ ] **Step 5: Run all tests**

Run: `bun test && bunx tsc --noEmit`
Expected: All tests pass, no type errors

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts src/__tests__/cli.test.ts
git commit -m "feat: add --lang flag and lang field in JSON output"
```

---

### Task 4: Manual verification

- [ ] **Step 1: Test JSON output with language**

```bash
bun src/cli.ts --json fixtures/benchmark/01-ne-nuzhno-slat-soobshcheniya.ogg
```

Expected: JSON array with `lang: "ru"` field.

- [ ] **Step 2: Test --lang mismatch warning**

```bash
bun src/cli.ts --lang en fixtures/benchmark/01-ne-nuzhno-slat-soobshcheniya.ogg 2>&1
```

Expected: Warning on stderr about expected "en" but detected "ru". Transcript still output.

- [ ] **Step 3: Test --lang match (no warning)**

```bash
bun src/cli.ts --lang ru fixtures/benchmark/01-ne-nuzhno-slat-soobshcheniya.ogg 2>&1
```

Expected: No warning. Transcript output normally.

- [ ] **Step 4: Test --help shows --lang**

```bash
bun src/cli.ts --help
```

Expected: `--lang` appears in OPTIONS.

- [ ] **Step 5: Run full verification**

```bash
bun test && bunx tsc --noEmit
```

Expected: All tests pass, no type errors.
