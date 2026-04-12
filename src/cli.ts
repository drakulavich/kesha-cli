#!/usr/bin/env bun

import { defineCommand, runMain } from "citty";
import { detect } from "tinyld";
import { transcribe } from "./lib";
import { downloadModel } from "./onnx-install";
import { downloadCoreML } from "./coreml-install";
import { downloadLangIdOnnx, downloadLangIdCoreML } from "./lang-id-install";
import { isMacArm64 } from "./coreml";
import { detectAudioLanguageCoreML, detectTextLanguageCoreML } from "./coreml";
import { detectAudioLanguageOnnx } from "./lang-id";
import type { LangDetectResult } from "./lang-id";
import { log } from "./log";
import { showStatus } from "./status";

export function detectLanguage(text: string): string {
  if (!text) return "";
  return detect(text);
}

export function checkLanguageMismatch(expected: string | undefined, detected: string): string | null {
  if (!expected || !detected || expected === detected) return null;
  return `warning: expected language "${expected}" but detected "${detected}"`;
}

export interface InstallOptions {
  coreml: boolean;
  onnx: boolean;
  noCache: boolean;
}

interface InstallCommandArgs {
  coreml: boolean;
  onnx: boolean;
  "no-cache": boolean;
}

interface MainCommandArgs {
  _: string[];
  json: boolean;
  verbose: boolean;
  lang?: string;
}

const pkg = await Bun.file(new URL("../package.json", import.meta.url)).json();

export function resolveInstallBackend(options: InstallOptions, macArm64 = isMacArm64()): "coreml" | "onnx" {
  const { coreml, onnx } = options;

  if (coreml && onnx) {
    throw new Error('Choose only one backend: "--coreml" or "--onnx".');
  }

  if (coreml) {
    if (!macArm64) {
      throw new Error("CoreML backend is only available on macOS Apple Silicon.");
    }
    return "coreml";
  }

  if (onnx) {
    return "onnx";
  }

  return macArm64 ? "coreml" : "onnx";
}

async function performInstall(options: InstallOptions) {
  const { noCache } = options;
  try {
    const backend = resolveInstallBackend(options);
    if (backend === "coreml") {
      await downloadCoreML(noCache);
      await downloadLangIdCoreML(noCache);
    } else {
      await downloadModel(noCache);
      await downloadLangIdOnnx(noCache);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(message);
    process.exit(1);
  }
}

export const installCommand = defineCommand({
  meta: {
    name: "install",
    description: "Download speech-to-text models",
  },
  args: {
    coreml: {
      type: "boolean",
      description: "Force CoreML backend (macOS arm64)",
      default: false,
    },
    onnx: {
      type: "boolean",
      description: "Force ONNX backend",
      default: false,
    },
    "no-cache": {
      type: "boolean",
      description: "Re-download even if cached",
      default: false,
    },
  },
  async run({ args }: { args: InstallCommandArgs }) {
    await performInstall({ coreml: args.coreml, onnx: args.onnx, noCache: args["no-cache"] });
  },
});

export const statusCommand = defineCommand({
  meta: {
    name: "status",
    description: "Show backend installation status",
  },
  async run() {
    await showStatus();
  },
});

export const mainCommand = defineCommand({
  meta: {
    name: "parakeet",
    version: pkg.version,
    description:
      "Fast local speech-to-text. 25 languages. CoreML on Apple Silicon, ONNX on CPU.\n" +
      "  Run 'parakeet install [--coreml | --onnx] [--no-cache]' to download models.\n" +
      "  Run 'parakeet status' to inspect installed backends.",
  },
  args: {
    json: {
      type: "boolean",
      description: "Output results as JSON",
      default: false,
    },
    verbose: {
      type: "boolean",
      description: "Show language detection details",
      default: false,
    },
    lang: {
      type: "string",
      description: "Expected language code (ISO 639-1), warn if mismatch",
    },
  },
  async run({ args }: { args: MainCommandArgs }) {
    const files = args._;

    if (files.length === 0) {
      log.info("Usage: parakeet <audio_file> [audio_file ...]\n       parakeet install [--coreml | --onnx] [--no-cache]\n       parakeet status");
      process.exit(1);
    }

    let hasError = false;
    const results: TranscribeResult[] = [];

    const wantsLangId = !!(args.lang || args.verbose || args.json);

    for (const file of files) {
      try {
        // Pre-transcription audio lang-id (lazy)
        let audioLanguage: LangDetectResult | undefined;
        if (wantsLangId) {
          const audioResult = isMacArm64()
            ? await detectAudioLanguageCoreML(file)
            : await detectAudioLanguageOnnx(file);
          if (audioResult && audioResult.code) {
            audioLanguage = audioResult;
          }
        }

        // Audio lang-id mismatch warning (pre-transcription)
        if (audioLanguage && args.lang && audioLanguage.confidence > 0.8) {
          const mismatch = checkLanguageMismatch(args.lang, audioLanguage.code);
          if (mismatch) log.warn(`${file}: ${mismatch} (from audio)`);
        }

        // Transcribe
        const text = await transcribe(file);

        // Post-transcription text lang-id
        const tinyldLang = detectLanguage(text);
        let textLanguage: LangDetectResult | undefined;

        // Try NLLanguageRecognizer on macOS (takes priority)
        const coremlTextResult = await detectTextLanguageCoreML(text);
        if (coremlTextResult && coremlTextResult.code) {
          textLanguage = coremlTextResult;
        }

        // Use NLLanguageRecognizer result for lang field when available, else tinyld
        const lang = textLanguage?.code || tinyldLang;

        // Text lang-id mismatch warning (post-transcription, existing behavior)
        const mismatchWarning = checkLanguageMismatch(args.lang, lang);
        if (mismatchWarning) log.warn(`${file}: ${mismatchWarning}`);

        results.push({
          file,
          text,
          lang,
          audioLanguage,
          textLanguage: textLanguage ?? (tinyldLang ? { code: tinyldLang, confidence: 0 } : undefined),
        });
      } catch (err: unknown) {
        hasError = true;
        const message = err instanceof Error ? err.message : String(err);
        log.error(`${file}: ${message}`);
      }
    }

    if (args.json) {
      process.stdout.write(formatJsonOutput(results));
    } else if (args.verbose) {
      process.stdout.write(formatVerboseOutput(results));
    } else {
      process.stdout.write(formatTextOutput(results));
    }

    if (hasError) process.exit(1);
  },
});

export async function runCli(rawArgs = process.argv.slice(2)): Promise<void> {
  const [firstArg, ...restArgs] = rawArgs;

  if (firstArg === "install") {
    await runMain(installCommand, { rawArgs: restArgs });
    return;
  }

  if (firstArg === "status") {
    await runMain(statusCommand, { rawArgs: restArgs });
    return;
  }

  await runMain(mainCommand, { rawArgs });
}

export type TranscribeResult = {
  file: string;
  text: string;
  lang: string;
  audioLanguage?: LangDetectResult;
  textLanguage?: LangDetectResult;
};

export function formatTextOutput(results: TranscribeResult[]): string {
  if (results.length === 1) {
    return results[0].text + "\n";
  }
  return results
    .map((r, i) => (i > 0 ? "\n" : "") + `=== ${r.file} ===\n${r.text}\n`)
    .join("");
}

export function formatVerboseOutput(results: TranscribeResult[]): string {
  return results
    .map((r, i) => {
      const lines: string[] = [];
      if (results.length > 1) {
        if (i > 0) lines.push("");
        lines.push(`=== ${r.file} ===`);
      }
      if (r.audioLanguage) {
        lines.push(`Audio language: ${r.audioLanguage.code} (confidence: ${r.audioLanguage.confidence.toFixed(2)})`);
      }
      const textLang = r.textLanguage ?? (r.lang ? { code: r.lang, confidence: 0 } : null);
      if (textLang) {
        const confStr = textLang.confidence > 0 ? ` (confidence: ${textLang.confidence.toFixed(2)})` : "";
        lines.push(`Text language: ${textLang.code}${confStr}`);
      }
      lines.push("---");
      lines.push(r.text);
      return lines.join("\n");
    })
    .join("\n") + "\n";
}

export function formatJsonOutput(results: TranscribeResult[]): string {
  return JSON.stringify(results, null, 2) + "\n";
}

if (import.meta.main) {
  await runCli();
}
