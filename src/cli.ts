#!/usr/bin/env bun

import { defineCommand, runMain } from "citty";
import { transcribe } from "./lib";
import { downloadModel } from "./onnx-install";
import { downloadCoreML } from "./coreml-install";
import { isMacArm64 } from "./coreml";
import { log } from "./log";

const pkg = await Bun.file(new URL("../package.json", import.meta.url)).json();

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
  async run({ args }) {
    // citty proxy resolves no-cache → noCache at runtime
    const noCache = args["no-cache"] ?? false;
    try {
      if (args.coreml) {
        if (!isMacArm64()) {
          log.error("CoreML backend is only available on macOS Apple Silicon.");
          process.exit(1);
        }
        await downloadCoreML(noCache);
      } else if (args.onnx) {
        await downloadModel(noCache);
      } else if (isMacArm64()) {
        await downloadCoreML(noCache);
      } else {
        await downloadModel(noCache);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(message);
      process.exit(1);
    }
  },
});

export const mainCommand = defineCommand({
  meta: {
    name: "parakeet",
    version: pkg.version,
    description:
      "Fast local speech-to-text. 25 languages. CoreML on Apple Silicon, ONNX on CPU.\n" +
      "  Run 'parakeet install [--coreml | --onnx] [--no-cache]' to download models.",
  },
  args: {
    json: {
      type: "boolean",
      description: "Output results as JSON",
      default: false,
    },
    coreml: {
      type: "boolean",
      description: "Force CoreML backend (install subcommand)",
      default: false,
    },
    onnx: {
      type: "boolean",
      description: "Force ONNX backend (install subcommand)",
      default: false,
    },
    "no-cache": {
      type: "boolean",
      description: "Re-download even if cached (install subcommand)",
      default: false,
    },
  },
  async run({ args }) {
    const positional = args._ as string[];

    // Manual subcommand routing: "parakeet install [flags]"
    if (positional[0] === "install") {
      const noCache = args["no-cache"] ?? false;
      try {
        if (args.coreml) {
          if (!isMacArm64()) {
            log.error("CoreML backend is only available on macOS Apple Silicon.");
            process.exit(1);
          }
          await downloadCoreML(noCache);
        } else if (args.onnx) {
          await downloadModel(noCache);
        } else if (isMacArm64()) {
          await downloadCoreML(noCache);
        } else {
          await downloadModel(noCache);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        log.error(message);
        process.exit(1);
      }
      return;
    }

    const files = positional;

    if (files.length === 0) {
      log.info("Usage: parakeet <audio_file> [audio_file ...]\n       parakeet install [--coreml | --onnx] [--no-cache]");
      process.exit(1);
    }

    let hasError = false;
    const results: Array<{ file: string; text: string }> = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const text = await transcribe(files[i]);

        if (args.json) {
          results.push({ file: files[i], text });
        } else {
          if (files.length > 1) {
            if (i > 0) process.stdout.write("\n");
            process.stdout.write(`=== ${files[i]} ===\n`);
          }
          if (text) process.stdout.write(text + "\n");
        }
      } catch (err: unknown) {
        hasError = true;
        const message = err instanceof Error ? err.message : String(err);
        log.error(`${files[i]}: ${message}`);
      }
    }

    if (args.json) {
      process.stdout.write(JSON.stringify(results, null, 2) + "\n");
    }

    if (hasError) process.exit(1);
  },
});

if (import.meta.main) {
  runMain(mainCommand);
}
