import { describe, test, expect } from "bun:test";
import {
  shouldShowStarPrompt,
  starSeenPath,
  readStarSeen,
  writeStarSeen,
  hasStarMarker,
} from "../../src/star";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

function mkTmpBinPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "kesha-star-test-"));
  return join(dir, "kesha-engine");
}

describe("shouldShowStarPrompt — version-bump gate", () => {
  test("first install (null seen) → show", () => {
    expect(shouldShowStarPrompt("1.2.0", null)).toBe(true);
  });

  test("same version → skip", () => {
    expect(shouldShowStarPrompt("1.2.0", "1.2.0")).toBe(false);
  });

  test("patch bump → skip", () => {
    expect(shouldShowStarPrompt("1.2.1", "1.2.0")).toBe(false);
    expect(shouldShowStarPrompt("1.2.99", "1.2.0")).toBe(false);
  });

  test("minor bump → show", () => {
    expect(shouldShowStarPrompt("1.3.0", "1.2.99")).toBe(true);
    expect(shouldShowStarPrompt("1.2.0", "1.1.3")).toBe(true);
  });

  test("major bump → show", () => {
    expect(shouldShowStarPrompt("2.0.0", "1.99.99")).toBe(true);
  });

  test("downgrade → skip", () => {
    expect(shouldShowStarPrompt("1.1.0", "1.2.0")).toBe(false);
    expect(shouldShowStarPrompt("1.0.0", "2.0.0")).toBe(false);
  });

  test("unparseable version → skip (don't nag on garbage)", () => {
    expect(shouldShowStarPrompt("not-a-version", "1.2.0")).toBe(false);
    expect(shouldShowStarPrompt("1.2.0", "garbage")).toBe(false);
    expect(shouldShowStarPrompt("1", "1.0.0")).toBe(false); // too few parts
  });

  test("npm-style prerelease still parses major/minor correctly", () => {
    // `1.3.0-rc.1`.split(".") → ["1", "3", "0-rc", "1"]; major/minor parse ok.
    expect(shouldShowStarPrompt("1.3.0-rc.1", "1.2.0")).toBe(true);
  });
});

describe("star-seen marker file", () => {
  test("starSeenPath appends .star-seen", () => {
    expect(starSeenPath("/bin/kesha-engine")).toBe("/bin/kesha-engine.star-seen");
  });

  test("round-trip write/read", () => {
    const binPath = mkTmpBinPath();
    expect(hasStarMarker(binPath)).toBe(false);
    writeStarSeen(binPath, "1.2.0");
    expect(hasStarMarker(binPath)).toBe(true);
    expect(readStarSeen(binPath)).toBe("1.2.0");
    rmSync(starSeenPath(binPath));
  });

  test("read returns null when missing", () => {
    const binPath = mkTmpBinPath();
    expect(readStarSeen(binPath)).toBeNull();
  });

  test("read returns null on empty / whitespace", () => {
    const binPath = mkTmpBinPath();
    writeFileSync(starSeenPath(binPath), "\n\n  ");
    expect(readStarSeen(binPath)).toBeNull();
    rmSync(starSeenPath(binPath));
  });

  test("overwrite replaces previous", () => {
    const binPath = mkTmpBinPath();
    writeStarSeen(binPath, "1.2.0");
    writeStarSeen(binPath, "1.3.0");
    expect(readStarSeen(binPath)).toBe("1.3.0");
    rmSync(starSeenPath(binPath));
  });
});
