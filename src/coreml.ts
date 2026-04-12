import { join } from "path";
import { homedir } from "os";
import { existsSync } from "fs";
import { unlinkSync } from "fs";
import { convertToWav16kMono } from "./audio";
import type { LangDetectResult } from "./lang-id";

export function isMacArm64(): boolean {
  return process.platform === "darwin" && process.arch === "arm64";
}

export function getCoreMLBinPath(): string {
  return join(homedir(), ".cache", "parakeet", "coreml", "bin", "parakeet-coreml");
}

export function isCoreMLInstalled(): boolean {
  return isMacArm64() && existsSync(getCoreMLBinPath());
}

export async function transcribeCoreML(audioPath: string): Promise<string> {
  try {
    return await runCoreML(audioPath);
  } catch (error) {
    if (!shouldRetryCoreMLWithWav(audioPath, error)) {
      throw error;
    }

    const wavPath = await convertToWav16kMono(audioPath);
    try {
      return await runCoreML(wavPath);
    } finally {
      try { unlinkSync(wavPath); } catch {}
    }
  }
}

export function shouldRetryCoreMLWithWav(audioPath: string, error: unknown): boolean {
  if (audioPath.toLowerCase().endsWith(".wav")) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  return message.includes("com.apple.coreaudio.avfaudio error");
}

export function parseCoreMLLangResult(stdout: string): LangDetectResult | null {
  try {
    const parsed = JSON.parse(stdout);
    if (typeof parsed.code !== "string" || typeof parsed.confidence !== "number") {
      return null;
    }
    return { code: parsed.code, confidence: parsed.confidence };
  } catch {
    return null;
  }
}

async function runCoreMLCommand(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const binPath = getCoreMLBinPath();
  const proc = Bun.spawn([binPath, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

export async function detectAudioLanguageCoreML(audioPath: string): Promise<LangDetectResult | null> {
  if (!isCoreMLInstalled()) return null;
  const { stdout, exitCode } = await runCoreMLCommand(["detect-lang", audioPath]);
  if (exitCode !== 0) return null;
  return parseCoreMLLangResult(stdout);
}

export async function detectTextLanguageCoreML(text: string): Promise<LangDetectResult | null> {
  if (!isCoreMLInstalled()) return null;
  const { stdout, exitCode } = await runCoreMLCommand(["detect-text-lang", text]);
  if (exitCode !== 0) return null;
  return parseCoreMLLangResult(stdout);
}

async function runCoreML(audioPath: string): Promise<string> {
  const { stdout, stderr, exitCode } = await runCoreMLCommand([audioPath]);
  if (exitCode !== 0) {
    throw new Error(stderr || `parakeet-coreml exited with code ${exitCode}`);
  }
  return stdout;
}
