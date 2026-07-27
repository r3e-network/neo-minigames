/**
 * Ported from the platform monorepo's
 * `deploy/scripts/lib/last_survivor_frontend_structure.test.mjs` (node:test ->
 * vitest, app root re-rooted at this repo). Moved whole: nothing else in this
 * repo guards the strict read path, the wallet-write journal, or the paid-entry
 * kill switch staying off.
 */
import { describe, expect, it } from "vitest";

import { read as readRepoFile } from "../test-utils/frontend-structure";

const read = (relativePath: string) => readRepoFile(`apps/last-survivor/${relativePath}`);

describe("last-survivor frontend structure", () => {
  it("ships one Phaser-first arena with direct shared imports", () => {
    const wrapper = read("src/PhaserPlayArea.tsx");
    const scene = read("src/scenes/LastSurvivorScene.ts");
    const main = read("src/main.tsx");

    expect(wrapper).toMatch(/LazyPhaserGameComponent/);
    expect(wrapper).toMatch(/@shared\/components-react\/v2\/PlayStage/);
    expect(wrapper).not.toMatch(/from ["']@shared\/components-react\/v2["']/);
    expect(scene).toMatch(/extends BaseScene/);
    expect(main).toMatch(/playArea:\s*PhaserPlayArea/);
    expect(`${wrapper}\n${scene}\n${main}`).not.toMatch(/three(?:\.js)?|ThreeGameComponent/);
  });

  it("fails closed on unknown reads and journals every wallet write", () => {
    const composable = read("src/composables/useLastSurvivor.ts");
    const journal = read("src/logic/pending-purchase-store.ts");
    const rpc = read("src/logic/last-survivor-rpc.ts");
    const main = read("src/main.tsx");

    expect(composable).toMatch(/function strictBigInt/);
    expect(composable).not.toMatch(/using local formula/);
    expect(composable).toMatch(/requireBoundContext\(true\)/);
    expect(composable).toMatch(/getMiniAppContractHash/);
    expect(composable).toMatch(/confirmOperationReadback/);
    expect(composable).toMatch(/kind:\s*"deposit"/);
    expect(composable).toMatch(/kind:\s*"purchase"/);
    expect(composable).toMatch(/kind:\s*"settle"/);
    expect(composable).toMatch(/kind:\s*"withdraw"/);
    expect(journal).toMatch(/assertAvailable/);
    expect(journal).toMatch(/pending-operation\/v2/);
    expect(rpc).toMatch(/method: "getapplicationlog"/);
    expect(rpc).toMatch(/state: "fault"/);
    expect(main).toMatch(/actions\.register\("recoverTransaction"/);
  });

  it("keeps paid entry closed until the current wallet matrix is verified", () => {
    const runtimeManifest = read("src/manifest.ts");
    const publicManifest = read("neo-manifest.json");
    const main = read("src/main.tsx");

    expect(runtimeManifest).toMatch(/supportsGameFi:\s*false/);
    expect(runtimeManifest).toMatch(/gamefi:\s*false/);
    expect((JSON.parse(publicManifest) as { platform: { transactions: boolean } }).platform.transactions).toBe(false);
    expect(main).toMatch(/NEW_PAID_ROUNDS_ENABLED\s*=\s*false/);
  });
});
