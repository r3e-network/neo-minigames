/**
 * Ported from the platform monorepo's
 * `deploy/scripts/lib/screw_sort_frontend_structure.test.mjs` (node:test ->
 * vitest, ROOT re-rooted at this repo). It is the only guard on Screw Sort's
 * no-timed-preview move flow and on its guest engine staying wallet-free, so
 * it moved whole rather than being folded into the app's own suite.
 */
import { describe, expect, it } from "vitest";

import { exists, read } from "../test-utils/frontend-structure";

describe("screw-sort frontend structure", () => {
  it("keeps Phaser 3 and its real workshop assets as the play surface", () => {
    const entry = read("apps/screw-sort/src/PlayArea.tsx").trim();
    const wrapper = read("apps/screw-sort/src/PhaserPlayArea.tsx");
    const scene = read("apps/screw-sort/src/scenes/ScrewSortScene.ts");
    const main = read("apps/screw-sort/src/main.tsx");

    expect(entry).toBe('export { default } from "./PhaserPlayArea";');
    expect(main).toMatch(/import PhaserPlayArea from "\.\/PhaserPlayArea"/);
    expect(main).toMatch(/playArea: PhaserPlayArea/);
    expect(main).toMatch(/const ensureGuestMode = \(\): boolean =>/);
    expect(wrapper).toMatch(/LazyPhaserGameComponent as PhaserGameComponent/);
    expect(wrapper).toMatch(/import\("\.\/scenes\/ScrewSortScene"\)/);
    expect(scene).toMatch(/extends BaseScene/);
    expect(scene).toMatch(/BaseScene\.preloadAssets/);
    for (const asset of [
      "workshop.webp",
      "plank.webp",
      "screw.webp",
      "toolbox.webp",
      "overflow-tray.webp",
    ]) {
      expect(exists(`apps/screw-sort/public/art/${asset}`), asset).toBe(true);
      expect(scene).toMatch(new RegExp(`\\./art/${asset.replace(".", "\\.")}`));
    }
    expect(`${wrapper}\n${scene}`).not.toMatch(
      /from ["']three["']|new THREE\.|<input\b|<textarea\b|<select\b/,
    );
  });

  it("presents an accepted engine revision instead of a timed success preview", () => {
    const wrapper = read("apps/screw-sort/src/PhaserPlayArea.tsx");
    const scene = read("apps/screw-sort/src/scenes/ScrewSortScene.ts");
    const requestStart = scene.indexOf("private requestScrewMove");
    const requestEnd = scene.indexOf("private releaseMoveLock", requestStart);
    const requestFlow = scene.slice(requestStart, requestEnd);
    const stateStart = scene.indexOf("protected onStateUpdate");
    const stateEnd = scene.indexOf("protected onBridgeError", stateStart);
    const stateFlow = scene.slice(stateStart, stateEnd);

    expect(wrapper).toMatch(/moveRequestRevision/);
    expect(wrapper).toMatch(/core\.revision > moveRequestRevision/);
    expect(wrapper).toMatch(/aria-busy=\{movePending \|\| undefined\}/);
    expect(wrapper).not.toMatch(/actionPreview|useTransientFlag|setTimeout\(/);
    expect(requestFlow).toMatch(/this\.dispatch\("selectScrew", screw\.id\)/);
    expect(requestFlow).not.toMatch(/delayedCall|this\.animate/);
    expect(stateFlow).toMatch(/revisionChanged/);
    expect(stateFlow).toMatch(/event\?\.kind === "move"/);
    expect(stateFlow).toMatch(/this\.playMoveAnimation\(event, previous, session\)/);
    expect(scene).not.toMatch(/startActionPreview|dispatchTimer/);
  });

  it("fails visibly recoverable while remaining wallet-free", () => {
    const engine = read("apps/screw-sort/src/logic/guest-engine.ts");
    const messages = read("apps/screw-sort/src/locale/messages.ts");
    const manifest = JSON.parse(read("apps/screw-sort/neo-manifest.json")) as {
      version: string;
      platform: { transactions: boolean };
      permissions: unknown[];
      operation_panel: { operations: unknown[] };
      technologies: Record<string, { enabled: boolean }>;
    };
    const sourceManifest = read("apps/screw-sort/src/manifest.ts");

    expect(engine).toMatch(/statusStorageUnavailable/);
    expect(engine).toMatch(/statusProgressReset/);
    expect(engine).toMatch(/statusLeaderboardUnavailable/);
    expect(messages).toMatch(/statusStorageUnavailable:/);
    expect(messages).toMatch(/statusProgressReset:/);
    expect(messages).toMatch(/statusLeaderboardUnavailable:/);
    expect(sourceManifest).toMatch(/supportsGameFi: false/);
    expect(manifest.version).toBe("1.1.0");
    expect(manifest.platform.transactions).toBe(false);
    expect(manifest.permissions).toEqual([]);
    expect(manifest.operation_panel.operations).toEqual([]);
    expect(manifest.technologies.aa!.enabled).toBe(false);
    expect(manifest.technologies.oracle!.enabled).toBe(false);
    expect(manifest.technologies.tee!.enabled).toBe(false);
    expect(engine).not.toMatch(/\.chain\.|\.wallet\.|invoke\(|payAndCall/);
  });
});
