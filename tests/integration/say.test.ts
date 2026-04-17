import { describe, it, expect } from "bun:test";
import { spawn } from "bun";

const CLI_PATH = new URL("../../bin/kesha.js", import.meta.url).pathname;

describe("kesha say (CLI)", () => {
  it("--help exits 0 and mentions --voice", async () => {
    const proc = spawn(["bun", CLI_PATH, "say", "--help"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exit = await proc.exited;
    expect(exit).toBe(0);
    const stdout = await new Response(proc.stdout).text();
    expect(stdout).toMatch(/--voice/);
  });

  it("shows install hint when engine not installed (empty cache)", async () => {
    const dir = `/tmp/kesha-empty-${Date.now()}-${Math.random()}`;
    const proc = spawn(["bun", CLI_PATH, "say", "Hello"], {
      env: { ...process.env, KESHA_CACHE_DIR: dir, HOME: dir },
      stdout: "pipe",
      stderr: "pipe",
    });
    const exit = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    // Engine not installed exits 1 from the TS wrapper; stderr should point at install.
    expect([1, 4]).toContain(exit);
    expect(stderr).toMatch(/install/);
  });
});
