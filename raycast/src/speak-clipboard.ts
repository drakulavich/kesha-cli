import { Clipboard, getPreferenceValues, showHUD } from "@raycast/api";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

interface Prefs {
  keshaBinPath?: string;
  defaultVoice?: string;
}

// Raycast caps the no-view body to ~2 min; keep synthesis bounded so we
// don't leak a background `kesha say` process on very long clipboards.
const MAX_CHARS = 4000;

export default async function Command() {
  const prefs = getPreferenceValues<Prefs>();
  const keshaBin = prefs.keshaBinPath?.trim() || "kesha";
  const voice = prefs.defaultVoice?.trim() || "";

  const text = (await Clipboard.readText())?.trim() ?? "";
  if (!text) {
    await showHUD("✗ Clipboard is empty");
    return;
  }
  if (text.length > MAX_CHARS) {
    await showHUD(`✗ Clipboard too long (${text.length} > ${MAX_CHARS} chars)`);
    return;
  }

  const dir = mkdtempSync(join(tmpdir(), "raycast-kesha-"));
  const wavPath = join(dir, "speak.wav");

  try {
    await showHUD("🎙  Synthesizing…");
    const args = ["say", text, "--out", wavPath];
    if (voice) {
      args.push("--voice", voice);
    }
    await execFileAsync(keshaBin, args, { maxBuffer: 4 * 1024 * 1024 });

    await showHUD("🔊 Playing…");
    await execFileAsync("/usr/bin/afplay", [wavPath]);
    await showHUD("✓ Played clipboard");
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") {
      await showHUD(
        `✗ \`${keshaBin}\` not found — see https://github.com/drakulavich/kesha-voice-kit#install`,
      );
    } else {
      // Don't echo the error message: Node's subprocess errors include the
      // full argv, which for this command contains the clipboard payload
      // (potentially a password, token, or anything else the user copied).
      // A generic HUD + console.error keeps the failure debuggable without
      // leaking clipboard bytes into macOS notification history.
      const message = err instanceof Error ? err.message : String(err);
      console.error("speak-clipboard failed:", message);
      await showHUD("✗ Speech synthesis failed (see extension logs)");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
