import { join } from "path";
import { homedir } from "os";
import { existsSync, mkdirSync } from "fs";
import { log } from "./log";
import { createProgressBar } from "./progress";

export const HF_REPO = "istupakov/parakeet-tdt-0.6b-v3-onnx";

export const MODEL_FILES = [
  "encoder-model.onnx",
  "encoder-model.onnx.data",
  "decoder_joint-model.onnx",
  "nemo128.onnx",
  "vocab.txt",
];

export function getModelDir(): string {
  return join(homedir(), ".cache", "parakeet", "v3");
}

export function isModelCached(dir?: string): boolean {
  const resolvedDir = dir ?? getModelDir();
  return MODEL_FILES.every((file) => existsSync(join(resolvedDir, file)));
}

export function installHintError(headline: string): Error {
  const lines = [
    headline,
    "",
    "╔══════════════════════════════════════════════════════════╗",
    "║ Please run the following command to get started:         ║",
    "║                                                          ║",
    "║     bunx @drakulavich/parakeet-cli install               ║",
    "╚══════════════════════════════════════════════════════════╝",
  ];
  return new Error(lines.join("\n"));
}

export function requireModel(modelDir?: string): string {
  const dir = modelDir ?? getModelDir();

  if (!isModelCached(dir)) {
    throw installHintError(`Error: Model not found at ${dir}`);
  }

  return dir;
}

export async function downloadModel(noCache = false, modelDir?: string): Promise<string> {
  const dir = modelDir ?? getModelDir();

  if (!noCache && isModelCached(dir)) {
    log.success("Model already downloaded.");
    return dir;
  }

  mkdirSync(dir, { recursive: true });

  for (const file of MODEL_FILES) {
    const url = `https://huggingface.co/${HF_REPO}/resolve/main/${file}`;
    const dest = join(dir, file);

    if (!noCache && existsSync(dest)) continue;

    let res: Response;
    try {
      res = await fetch(url, { redirect: "follow" });
    } catch (e) {
      throw new Error(
        `Failed to fetch ${file}: ${e instanceof Error ? e.message : e}\n  Fix: Check your network connection and try again`,
      );
    }

    if (!res.ok) {
      throw new Error(
        `Failed to download ${file}: HTTP ${res.status}\n  Fix: Check your network connection or try again with --no-cache`,
      );
    }

    if (!res.body) {
      throw new Error(
        `Download failed: empty response for ${file}\n  Fix: Try again — the server may be temporarily unavailable`,
      );
    }

    const totalBytes = Number(res.headers.get("content-length") || 0);
    const progress = createProgressBar(file, totalBytes);

    const writer = Bun.file(dest).writer();
    let bytes = 0;
    try {
      for await (const chunk of res.body) {
        writer.write(chunk);
        bytes += chunk.length;
        progress.update(chunk.length);
      }
    } finally {
      writer.end();
    }

    if (bytes === 0) {
      throw new Error(
        `Downloaded 0 bytes for ${file}\n  Fix: Try again — the server may be temporarily unavailable`,
      );
    }

    progress.finish();
  }

  log.success("Model downloaded successfully.");
  return dir;
}
