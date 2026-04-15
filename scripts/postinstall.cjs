#!/usr/bin/env node
// Warn if Bun is not on PATH. Uses fs-only probing instead of
// child_process.execSync("bun --version") so that OpenClaw's
// dangerous-code scanner does not flag the plugin install.
const fs = require("fs");
const path = require("path");

const exe = process.platform === "win32" ? "bun.exe" : "bun";
const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);

const found = dirs.some((dir) => {
  try {
    return fs.existsSync(path.join(dir, exe));
  } catch {
    return false;
  }
});

if (!found) {
  console.warn(
    "\n⚠️  Kesha Voice Kit requires Bun runtime.\n" +
      "   Install Bun: curl -fsSL https://bun.sh/install | bash\n" +
      "   Then run:    kesha install\n",
  );
}
