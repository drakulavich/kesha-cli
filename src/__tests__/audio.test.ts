import { describe, test, expect } from "bun:test";
import { getFfmpegInstallHint } from "../audio";

describe("getFfmpegInstallHint", () => {
  test("returns a non-empty string", () => {
    const hint = getFfmpegInstallHint();
    expect(hint).toBeTruthy();
    expect(typeof hint).toBe("string");
  });

  test("contains install keyword", () => {
    const hint = getFfmpegInstallHint();
    expect(hint).toMatch(/install|ffmpeg\.org/i);
  });
});
