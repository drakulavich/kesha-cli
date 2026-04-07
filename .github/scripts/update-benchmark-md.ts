#!/usr/bin/env bun
/**
 * Replace CI benchmark section in BENCHMARK.md between markers.
 * Usage: bun update-benchmark-md.ts <results-file> <benchmark-md>
 */

const resultsPath = process.argv[2];
const benchmarkPath = process.argv[3];
if (!resultsPath || !benchmarkPath) {
  console.error("Usage: bun update-benchmark-md.ts <results-file> <benchmark-md>");
  process.exit(1);
}

const replacement = await Bun.file(resultsPath).text();
const content = await Bun.file(benchmarkPath).text();

const pattern = /(<!-- CI-BENCHMARK-START -->)[\s\S]*?(<!-- CI-BENCHMARK-END -->)/;
const updated = content.replace(pattern, `$1\n${replacement}\n$2`);

if (updated === content) {
  console.error("WARNING: CI-BENCHMARK markers not found in BENCHMARK.md");
  process.exit(1);
}

await Bun.write(benchmarkPath, updated);
