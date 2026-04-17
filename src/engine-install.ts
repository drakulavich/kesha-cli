import { dirname } from "path";
import { existsSync, mkdirSync, chmodSync } from "fs";
import { getEngineBinPath, getEngineCapabilities } from "./engine";
import { log } from "./log";
import { streamResponseToFile } from "./progress";

const GITHUB_REPO = "drakulavich/kesha-voice-kit";

function getEngineBinaryName(): string {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "darwin" && arch === "arm64") return "kesha-engine-darwin-arm64";
  if (platform === "linux" && arch === "x64") return "kesha-engine-linux-x64";
  if (platform === "win32" && arch === "x64") return "kesha-engine-windows-x64.exe";

  throw new Error(`Unsupported platform: ${platform} ${arch}`);
}

export interface InstallOptions {
  /** Also install Kokoro TTS models. Requires espeak-ng on PATH. */
  tts?: boolean;
}

export async function downloadEngine(
  noCache = false,
  backend?: string,
  options: InstallOptions = {},
): Promise<string> {
  const binPath = getEngineBinPath();

  if (!noCache && existsSync(binPath)) {
    log.success("Engine binary already installed.");
  } else {
    const binaryName = getEngineBinaryName();
    const pkg = await Bun.file(new URL("../package.json", import.meta.url)).json();
    // The engine version is tracked separately from the CLI version so
    // CLI-only patch releases don't require cutting a new GitHub release
    // + Rust rebuild. Fall back to the CLI version for backwards compat.
    const engineVersion =
      typeof pkg.keshaEngine?.version === "string"
        ? pkg.keshaEngine.version
        : typeof pkg.version === "string"
        ? pkg.version
        : "unknown";
    const url = `https://github.com/${GITHUB_REPO}/releases/download/v${engineVersion}/${binaryName}`;

    mkdirSync(dirname(binPath), { recursive: true });

    let res: Response;
    try {
      res = await fetch(url, { redirect: "follow" });
    } catch (e) {
      throw new Error(
        `Failed to fetch engine binary: ${e instanceof Error ? e.message : e}\n  Fix: Check your network connection and try again`,
      );
    }

    if (!res.ok) {
      throw new Error(
        `Failed to download engine binary (HTTP ${res.status})\n  Fix: Check https://github.com/${GITHUB_REPO}/releases for available versions`,
      );
    }

    await streamResponseToFile(res, binPath, "kesha-engine binary");
    chmodSync(binPath, 0o755);
    log.success("Engine binary downloaded.");
  }

  if (backend) {
    const caps = await getEngineCapabilities();
    if (caps && caps.backend !== backend) {
      throw new Error(
        `Requested backend "${backend}" is not available: the installed engine for this platform uses "${caps.backend}".\n  Fix: omit --${backend} to use the auto-detected backend, or run on a platform that ships the "${backend}" build.`,
      );
    }
  }

  log.progress("Installing models...");
  const installArgs = [
    "install",
    ...(noCache ? ["--no-cache"] : []),
    ...(options.tts ? ["--tts"] : []),
  ];
  const proc = Bun.spawnSync([binPath, ...installArgs], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stderr = proc.stderr.toString();
  if (stderr) {
    process.stderr.write(stderr);
  }

  if (proc.exitCode !== 0) {
    const detail = stderr.trim();
    throw new Error(detail ? `Failed to install models: ${detail}` : "Failed to install models");
  }

  log.success("Backend installed successfully.");
  return binPath;
}
