import { describe, test, expect } from "bun:test";
import { renderUsage } from "citty";
import { mainCommand, installCommand, formatTextOutput, formatJsonOutput } from "../cli";

describe("CLI help", () => {
  test("main help contains usage and install info", async () => {
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

describe("output formatting", () => {
  test("single file text: no header", () => {
    const output = formatTextOutput([{ file: "a.ogg", text: "Hello" }]);
    expect(output).toBe("Hello\n");
  });

  test("multiple files text: headers per file", () => {
    const output = formatTextOutput([
      { file: "a.ogg", text: "Hello" },
      { file: "b.mp3", text: "World" },
    ]);
    expect(output).toBe("=== a.ogg ===\nHello\n\n=== b.mp3 ===\nWorld\n");
  });

  test("JSON output: always array, pretty-printed", () => {
    const output = formatJsonOutput([{ file: "a.ogg", text: "Hello" }]);
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toEqual([{ file: "a.ogg", text: "Hello" }]);
    expect(output).toContain("\n");
  });

  test("JSON output: multiple files", () => {
    const output = formatJsonOutput([
      { file: "a.ogg", text: "Hello" },
      { file: "b.mp3", text: "World" },
    ]);
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].file).toBe("a.ogg");
    expect(parsed[1].file).toBe("b.mp3");
  });

  test("JSON output: empty array when no results", () => {
    const output = formatJsonOutput([]);
    expect(JSON.parse(output)).toEqual([]);
  });
});
