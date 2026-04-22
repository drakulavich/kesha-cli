import { isEngineInstalled, transcribeEngine } from "./engine";

export interface TranscribeOptions {
  silent?: boolean;
  /** Silero VAD preprocessing mode:
   *  - `true` — force on (requires `kesha install --vad`)
   *  - `false` — force off, even for long audio
   *  - `undefined` (default) — auto-on when audio ≥ 120 s and VAD is installed
   *  See #187. */
  vad?: boolean;
}

export async function transcribe(audioPath: string, opts: TranscribeOptions = {}): Promise<string> {
  if (!isEngineInstalled()) {
    throw new Error(
      "Error: No transcription backend is installed\n\n" +
      "╔══════════════════════════════════════════════════════════╗\n" +
      "║ Please run the following command to get started:         ║\n" +
      "║                                                          ║\n" +
      "║     bunx @drakulavich/kesha-voice-kit install               ║\n" +
      "╚══════════════════════════════════════════════════════════╝",
    );
  }

  return transcribeEngine(audioPath, { vad: opts.vad });
}
