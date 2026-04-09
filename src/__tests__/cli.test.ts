import { describe, test, expect } from "bun:test";
import { renderUsage } from "citty";
import { mainCommand, installCommand } from "../cli";

describe("CLI help", () => {
  test("main help contains usage and commands", async () => {
    const usage = await renderUsage(mainCommand);
    expect(usage).toContain("USAGE");
    expect(usage).toContain("install");
  });

  test("install help contains backend options", async () => {
    const usage = await renderUsage(installCommand);
    expect(usage).toContain("--coreml");
    expect(usage).toContain("--onnx");
    expect(usage).toContain("--no-cache");
  });

  test("main help contains --json flag", async () => {
    const usage = await renderUsage(mainCommand);
    expect(usage).toContain("--json");
  });
});
