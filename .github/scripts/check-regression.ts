#!/usr/bin/env bun
/**
 * Check benchmark results for regression against previous results.
 * Usage: bun check-regression.ts <summary.json> <benchmark.md> [--threshold=0.2]
 * Exit code 1 if parakeet_total degraded by more than threshold.
 */

const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
const thresholdArg = process.argv.find(a => a.startsWith("--threshold="));
const threshold = thresholdArg ? parseFloat(thresholdArg.split("=")[1]) : 0.2;

if (args.length < 2) {
  console.error("Usage: bun check-regression.ts <summary.json> <benchmark.md> [--threshold=0.2]");
  process.exit(1);
}

const [summaryPath, benchmarkPath] = args;

const current = await Bun.file(summaryPath).json();
const currentTotal: number = current.parakeet_total;

// Extract previous total from BENCHMARK.md
let previousTotal: number | null = null;
try {
  const content = await Bun.file(benchmarkPath).text();
  const match = content.match(
    /<!-- CI-BENCHMARK-START -->([\s\S]*?)<!-- CI-BENCHMARK-END -->/
  );
  if (match) {
    const totalMatch = match[1].match(/\*\*Total\*\*.*?\*\*(\d+\.?\d*)s\*\*.*?\*\*(\d+\.?\d*)s\*\*/);
    if (totalMatch) previousTotal = parseFloat(totalMatch[2]);
  }
} catch {
  // File not found — no previous results
}

if (previousTotal === null) {
  console.log(`No previous results found. Current: ${currentTotal}s`);
  process.exit(0);
}

if (previousTotal === 0) {
  console.log(`Previous total is 0, skipping regression check. Current: ${currentTotal}s`);
  process.exit(0);
}

const degradation = (currentTotal - previousTotal) / previousTotal;
const pct = (degradation * 100).toFixed(1);
console.log(`Previous: ${previousTotal}s | Current: ${currentTotal}s | Change: ${degradation > 0 ? "+" : ""}${pct}%`);

if (degradation > threshold) {
  console.log(`REGRESSION: +${pct}% exceeds ${(threshold * 100).toFixed(0)}% threshold`);
  process.exit(1);
}

console.log("OK: No significant regression.");
