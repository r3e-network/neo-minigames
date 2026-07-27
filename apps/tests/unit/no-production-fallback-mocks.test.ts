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

describe("On-chain tarot deck", () => {
  const cardsDir = path.join(repoRoot, "apps/on-chain-tarot/public/cards");

  it("ships a complete 78-card deck index", () => {
    // The platform half - that its legacy card URLs redirect into the published
    // bundle - stays in the platform. This half owns the deck's actual shape.
    const deck = JSON.parse(fs.readFileSync(path.join(cardsDir, "index.json"), "utf8"));

    expect(deck).toHaveLength(78);
    expect(deck[0]).toEqual(expect.objectContaining({ id: 0, name: "The Fool" }));
  });

  it("ships real WebP art for every card in the index", () => {
    const deck = JSON.parse(fs.readFileSync(path.join(cardsDir, "index.json"), "utf8")) as Array<{
      id: number;
      name: string;
    }>;

    const missing: string[] = [];
    for (const card of deck) {
      const slug = card.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const file = path.join(cardsDir, `${String(card.id).padStart(2, "0")}-${slug}.webp`);
      if (!fs.existsSync(file)) {
        missing.push(path.basename(file));
        continue;
      }
      // RIFF....WEBP - real bytes, not a placeholder.
      const header = fs.readFileSync(file).subarray(0, 12);
      if (header.toString("ascii", 0, 4) !== "RIFF" || header.toString("ascii", 8, 12) !== "WEBP") {
        missing.push(`${path.basename(file)} (not WebP)`);
      }
    }

    expect(missing).toEqual([]);
  });
});
