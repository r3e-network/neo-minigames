import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The game-owned half of the platform's production-data guardrails, which used
 * to read this file across the repo boundary. The assertions are the
 * platform's verbatim; what moved is which repo holds the source being scanned.
 */
const repoRoot = path.resolve(__dirname, "../../..");

describe("Production data guardrails", () => {
  it("does not ship a local tarot reading fallback", () => {
    const tarotSource = fs.readFileSync(
      path.join(repoRoot, "apps/on-chain-tarot/src/composables/useTarot.ts"),
      "utf8",
    );

    expect(tarotSource).not.toContain("drawLocalPreviewCards");
    expect(tarotSource).not.toContain("using local preview");
  });
});

describe("LastSurvivor standalone entry", () => {
  it("does not expose lifecycle settlement as a standalone DApp action", () => {
    const standaloneEntry = fs.readFileSync(
      path.join(repoRoot, "apps/last-survivor/src/main.tsx"),
      "utf8",
    );

    expect(standaloneEntry).not.toContain('registerAction("claimPrize"');
  });
});
