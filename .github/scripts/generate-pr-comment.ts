#!/usr/bin/env bun
/**
 * Generate a PR comment from JUnit test result artifacts.
 * Usage: bun generate-pr-comment.ts <results-dir> <output-file>
 */

import { Glob } from "bun";
import { parseJunit, toMarkdown } from "./junit-to-markdown";

const resultsDir = process.argv[2];
const outputFile = process.argv[3];
if (!resultsDir || !outputFile) {
  console.error("Usage: bun generate-pr-comment.ts <results-dir> <output-file>");
  process.exit(1);
}

const lines: string[] = [
  "## Test Results",
  "",
  "| Platform | Status | Tests | Time |",
  "|----------|--------|-------|------|",
];

// Unit tests — summary row per platform
for (const pattern of ["test-results-ubuntu-*", "test-results-windows-*", "test-results-macos-*"]) {
  const glob = new Glob(`${resultsDir}/${pattern}/unit-*.xml`);
  for (const xml of glob.scanSync(".")) {
    const name = xml.split("/").pop()!.replace("unit-", "").replace(".xml", "");
    const results = await parseJunit(xml);
    lines.push(toMarkdown(name, results, true));
  }
}

lines.push("");

// Integration tests — full table
const integrationGlob = new Glob(`${resultsDir}/test-results-*/integration.xml`);
for (const xml of integrationGlob.scanSync(".")) {
  const results = await parseJunit(xml);
  lines.push(toMarkdown("Integration Tests", results, false));
}

await Bun.write(outputFile, lines.join("\n") + "\n");
