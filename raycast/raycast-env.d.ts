/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** `kesha` binary path - Absolute path to the `kesha` CLI. Leave blank to use PATH (default). */
  "keshaBinPath": string,
  /** Default voice (Speak Clipboard) - Voice id passed to `kesha say --voice`. Leave blank to let Kesha auto-route by detected language. */
  "defaultVoice": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `transcribe-selected-file` command */
  export type TranscribeSelectedFile = ExtensionPreferences & {}
  /** Preferences accessible in the `speak-clipboard` command */
  export type SpeakClipboard = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `transcribe-selected-file` command */
  export type TranscribeSelectedFile = {}
  /** Arguments passed to the `speak-clipboard` command */
  export type SpeakClipboard = {}
}

