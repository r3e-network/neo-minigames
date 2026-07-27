/**
 * Structure-test helpers, vendored from the platform monorepo's
 * `deploy/scripts/lib/frontend_structure_helpers.mjs` when the game apps moved
 * to this repo. ROOT is re-rooted at the neo-minigames checkout: these helpers
 * must never reach back into the platform tree.
 *
 * The node:assert assertions were converted to vitest `expect` so the ported
 * suites run under this repo's single vitest config. Only the helpers the game
 * suites actually use were carried over - the platform copy keeps the rest for
 * the non-game app repo.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

/** neo-minigames repo root (apps/tests/test-utils -> ../../..). */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

export function exists(relativePath: string): boolean {
  return existsSync(join(ROOT, relativePath));
}

export function assertAssets(paths: string[]): void {
  for (const assetPath of paths) {
    expect(exists(assetPath), `missing asset ${assetPath}`).toBe(true);
  }
}

export function assertMessageKeys(source: string, keys: string[], label = "messages"): void {
  for (const key of keys) {
    expect(source, `${label} missing ${key}`).toMatch(new RegExp(`\\b${key}:`));
  }
}

export function assertModernTypography(styles: string, label = "styles"): void {
  expect(styles, `${label} should not scale type with viewport width`).not.toMatch(
    /font-size:\s*clamp\(/,
  );
  const nonZeroTracking = [...styles.matchAll(/letter-spacing:\s*([^;]+);/g)]
    .map((match) => match[1]!.trim())
    .filter((value) => value !== "0" && value !== "0px" && value !== "normal");
  expect(nonZeroTracking, `${label} should keep letter spacing at 0`).toEqual([]);
}
