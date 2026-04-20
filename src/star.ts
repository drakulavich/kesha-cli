import { existsSync, readFileSync, writeFileSync } from "fs";

/**
 * Version-bump gate for the "star the repo" prompt in `kesha install`.
 *
 * Prompts are valuable on first install and on meaningful upgrades (new
 * features) but annoying on patch-only bumps. This module persists the
 * last-seen version to a marker file next to the engine binary and only
 * returns true on a major-or-minor bump.
 */
export function starSeenPath(binPath: string): string {
  return `${binPath}.star-seen`;
}

export function readStarSeen(binPath: string): string | null {
  try {
    const v = readFileSync(starSeenPath(binPath), "utf-8").trim();
    return v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function writeStarSeen(binPath: string, version: string): void {
  writeFileSync(starSeenPath(binPath), `${version}\n`);
}

function parseMajorMinor(v: string): [number, number] | null {
  const parts = v.split(".");
  if (parts.length < 2) return null;
  const major = Number(parts[0]);
  const minor = Number(parts[1]);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return null;
  return [major, minor];
}

/**
 * Returns true iff `current` represents a major-or-minor bump over `seen`.
 * - `seen === null` → true (first install, always prompt once).
 * - Same or downgraded version → false.
 * - Patch-only bump → false (annoying on every install).
 * - Unparseable either side → false (don't nag when we can't reason).
 */
export function shouldShowStarPrompt(current: string, seen: string | null): boolean {
  if (seen === null) return true;
  const c = parseMajorMinor(current);
  const s = parseMajorMinor(seen);
  if (!c || !s) return false;
  if (c[0] > s[0]) return true;
  if (c[0] === s[0] && c[1] > s[1]) return true;
  return false;
}

/** True when a star-seen marker already exists for this install. */
export function hasStarMarker(binPath: string): boolean {
  return existsSync(starSeenPath(binPath));
}
