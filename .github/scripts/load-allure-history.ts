#!/usr/bin/env bun
/**
 * Manage Allure report snapshots on gh-pages.
 * Keeps last 10 runs, latest gets an index.html redirect.
 * Expects: allure-report/ with the current report.
 * Outputs: deploy/ directory ready for gh-pages publish.
 */

import { mkdirSync, cpSync, rmSync, readdirSync, existsSync } from "fs";

const KEEP = 10;
const REPO = process.env.GITHUB_REPOSITORY ?? "";

// Clone gh-pages to get existing reports
const ghPages = "gh-pages";
if (!existsSync(ghPages)) {
  const result = Bun.spawnSync(
    ["git", "clone", "--depth=1", "--branch=gh-pages", `https://github.com/${REPO}.git`, ghPages],
    { stdout: "pipe", stderr: "pipe" }
  );
  if (result.exitCode !== 0) mkdirSync(ghPages, { recursive: true });
}

mkdirSync("deploy/reports/allure", { recursive: true });

// Copy existing snapshots
const existingDir = `${ghPages}/reports/allure`;
if (existsSync(existingDir)) {
  cpSync(existingDir, "deploy/reports/allure", { recursive: true });
}

// Find next snapshot number
let latest = 0;
if (existsSync("deploy/reports/allure")) {
  for (const entry of readdirSync("deploy/reports/allure")) {
    const num = parseInt(entry, 10);
    if (!isNaN(num) && num > latest) latest = num;
  }
}
const next = latest + 1;

// Copy new report as next snapshot
cpSync("allure-report", `deploy/reports/allure/${next}`, { recursive: true });

// Create redirect index.html
await Bun.write(
  "deploy/reports/allure/index.html",
  `<!DOCTYPE html><meta http-equiv="refresh" content="0;url=${next}/index.html">`
);

// Remove old snapshots beyond KEEP
for (const entry of readdirSync("deploy/reports/allure")) {
  const num = parseInt(entry, 10);
  if (!isNaN(num) && num <= next - KEEP) {
    rmSync(`deploy/reports/allure/${entry}`, { recursive: true, force: true });
  }
}

console.log(`Report snapshot ${next} created. Keeping last ${KEEP}.`);
