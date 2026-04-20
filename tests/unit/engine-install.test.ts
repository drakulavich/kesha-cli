import { describe, test, expect } from "bun:test";
import {
  getVersionMarkerPath,
  readInstalledEngineVersion,
  writeInstalledEngineVersion,
} from "../../src/engine-install";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

function mkTmpBinPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "kesha-install-test-"));
  return join(dir, "kesha-engine");
}

describe("engine-install version marker (#151)", () => {
  test("getVersionMarkerPath appends .version alongside binary", () => {
    expect(getVersionMarkerPath("/bin/kesha-engine")).toBe("/bin/kesha-engine.version");
    expect(getVersionMarkerPath("/tmp/foo/x")).toBe("/tmp/foo/x.version");
  });

  test("reads back what was written", () => {
    const binPath = mkTmpBinPath();
    writeInstalledEngineVersion(binPath, "1.2.0");
    expect(readInstalledEngineVersion(binPath)).toBe("1.2.0");
    rmSync(binPath + ".version");
  });

  test("returns null when marker missing", () => {
    const binPath = mkTmpBinPath();
    expect(readInstalledEngineVersion(binPath)).toBeNull();
  });

  test("returns null for empty marker (corrupted file treated as missing)", () => {
    const binPath = mkTmpBinPath();
    writeFileSync(binPath + ".version", "");
    expect(readInstalledEngineVersion(binPath)).toBeNull();
    rmSync(binPath + ".version");
  });

  test("returns null for whitespace-only marker", () => {
    const binPath = mkTmpBinPath();
    writeFileSync(binPath + ".version", "  \n  ");
    expect(readInstalledEngineVersion(binPath)).toBeNull();
    rmSync(binPath + ".version");
  });

  test("trims trailing newlines on read", () => {
    const binPath = mkTmpBinPath();
    writeInstalledEngineVersion(binPath, "1.2.0");
    expect(readInstalledEngineVersion(binPath)).toBe("1.2.0");
    rmSync(binPath + ".version");
  });

  test("overwrite replaces previous version", () => {
    const binPath = mkTmpBinPath();
    writeInstalledEngineVersion(binPath, "1.1.3");
    writeInstalledEngineVersion(binPath, "1.2.0");
    expect(readInstalledEngineVersion(binPath)).toBe("1.2.0");
    rmSync(binPath + ".version");
  });
});
