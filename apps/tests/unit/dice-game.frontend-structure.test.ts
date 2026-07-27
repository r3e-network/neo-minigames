/**
 * Ported from the platform monorepo's
 * `deploy/scripts/lib/dice_game_frontend_structure.test.mjs` (node:test ->
 * vitest, ROOT re-rooted at this repo). Moved whole: the Phaser-owned action
 * surface, the modulo-bias-free practice RNG and the canonical settlement
 * readback have no equivalent guard in this repo's dice-game suites.
 */
import { describe, expect, it } from "vitest";

import { exists, read } from "../test-utils/frontend-structure";

describe("dice-game frontend structure", () => {
  it("routes its visible play surface through Phaser 3", () => {
    const entry = read("apps/dice-game/src/PlayArea.tsx").trim();
    const wrapper = read("apps/dice-game/src/PhaserPlayArea.tsx");

    expect(entry).toBe('export { default } from "./PhaserPlayArea";');
    expect(wrapper).toMatch(/LazyPhaserGameComponent as PhaserGameComponent/);
    expect(wrapper).toMatch(/const loadDiceScene = \(\) =>\s*\n\s*import\("\.\/scenes\/DiceScene"\)/);
    expect(wrapper).toMatch(/<div className="dice-stage-shell">/);
    expect(wrapper).toMatch(/<div className="dice-stage-status" aria-live="polite">/);
    expect(wrapper).toMatch(/<div className="dice-stage-hud" aria-label=\{t\("rollSummary"\)\}>/);
    expect(wrapper).toMatch(/className="dice-ingame-drawer"/);
    expect(wrapper).toMatch(/role="dialog"/);
    expect(wrapper).toMatch(/aria-controls=\{RULES_DRAWER_ID\}/);
    expect(wrapper).toMatch(/role="radiogroup"/);
    expect(wrapper).toMatch(/role="radio"/);
    expect(wrapper).toMatch(/dispatch\("setSelectedFace"/);
    expect(wrapper).toMatch(/dispatch\("setStakeAmount"/);
    expect(wrapper).toMatch(/dispatch\("placeDiceBet"/);
    expect(wrapper).toMatch(/errorLabel=\{t\("gameActionFailed"\)\}/);
    expect(wrapper).toMatch(/retryLabel=\{t\("retry"\)\}/);
    expect(wrapper).toMatch(/enableSoundLabel=\{t\("enableGameSound"\)\}/);
    expect(wrapper).toMatch(/muteSoundLabel=\{t\("muteGameSound"\)\}/);
    expect(wrapper).toMatch(/lastPayout:\s+str\("lastPayout"/);
    expect(wrapper).toMatch(/formatHash\(row\.txid, 6, 4\)/);

    // The Phaser scene owns the game actions; the React layer is only its HUD,
    // history/rules drawer, and keyboard/screen-reader mirror.
    expect(wrapper).toMatch(/actions=\{\{\}\}/);
    expect(wrapper).not.toMatch(/OpenUiForm|OpenUiSegmented|<form\b|type="number"/);
    expect(wrapper).not.toMatch(/FACES\.map|dice-scene__die-anchor|mx2-roll/);
  });

  it("uses real dice and chip resources as the playable controls", () => {
    const scene = read("apps/dice-game/src/scenes/DiceScene.ts");

    expect(scene).toMatch(/const DIE_SIZE\s+=\s+112;/);
    expect(scene).toMatch(/const DIE_FACE_FILES = \[/);
    for (let face = 1; face <= 6; face += 1) {
      expect(scene).toMatch(new RegExp(`\\./art/die-white-${face}\\.webp`));
    }
    for (const fileName of [
      "chip-green.webp",
      "chip-blue.webp",
      "chip-red.webp",
      "chip-black.webp",
    ]) {
      expect(scene).toMatch(new RegExp(`\\./art/${fileName.replace(".", "\\.")}`));
    }
    expect(scene).toMatch(/officialGasTokenPhaserUrl/);
    expect(scene).toMatch(/this\.load\.image\(ASSET_GAS_ICON, officialGasTokenPhaserUrl\)/);
    expect(scene).toMatch(/private buildDice\(/);
    expect(scene).toMatch(/private buildFaceButton\(/);
    expect(scene).toMatch(/private buildChip\(/);
    expect(scene).toMatch(/private buildRollButton\(/);
    expect(scene).toMatch(/this\.dispatch\("placeDiceBet"/);
    expect(scene).toMatch(/private startRoll\(\)/);
    expect(scene).toMatch(/this\.shuffleTimer = this\.time\.addEvent/);
    expect(scene).toMatch(/targets: this\.dieShadow/);
    expect(scene).toMatch(/private stopRoll\(face: number\)/);
    expect(scene).toMatch(/ease: "Bounce\.easeOut"/);
    expect(scene).toMatch(/onComplete: \(\) => this\.emitLandingRipple\(\)/);

    // Reduced-motion users get a stable die instead of hidden looping motion;
    // changing the preference while rolling also tears active loops down.
    expect(scene).toMatch(/if \(this\.reducedMotion\) \{[\s\S]*?this\.dieShadow\.setScale\(1\)/);
    expect(scene).toMatch(/protected onReducedMotionChange\(enabled: boolean\)/);
    expect(scene).toMatch(/this\.shuffleTimer\?\.remove\(false\)/);
    expect(scene).toMatch(/this\.tweens\.killTweensOf\(this\.diceGroup\)/);

    // Practice wins throw actual chip textures. Official GAS artwork is reserved
    // for GameFi, and the settled banner reads the immutable settled payout.
    expect(scene).toMatch(/const isGuest = this\.str\("mode", "guest"\) === "guest"/);
    expect(scene).toMatch(
      /isGuest\s*\n\s*\? CHIP_PRESETS\[i % CHIP_PRESETS\.length\]!\.asset\s*\n\s*: ASSET_GAS_ICON/,
    );
    expect(scene).toMatch(/"lastPayout"/);
    expect(scene).not.toMatch(/Math\.random|Runtime\.GetRandom/);
    expect(scene).not.toMatch(/[🎲🎰🪙💰✨]/u);
  });

  it("keeps practice RNG failing closed and free of modulo bias", () => {
    const guestEngine = read("apps/dice-game/src/logic/guest-engine.ts");

    expect(guestEngine).toMatch(/export function rollLocalDie/);
    expect(guestEngine).toMatch(/cryptoSource\?\.getRandomValues/);
    expect(guestEngine).toMatch(/if \(value < 252\) return \(value % 6\) \+ 1/);
    expect(guestEngine).toMatch(/for \(let attempt = 0; attempt < 128; attempt \+= 1\)/);
    expect(guestEngine).toMatch(/if \(rolled === null\)/);
    expect(guestEngine).toMatch(/t\("guestRandomUnavailable"\)/);
    expect(guestEngine).toMatch(/reduceMotion \? REDUCED_MOTION_REVEAL_MS : REVEAL_MS/);
    expect(guestEngine).not.toMatch(/Math\.random/);
  });

  it("requires exact canonical contract readback before GameFi settlement", () => {
    const main = read("apps/dice-game/src/main.tsx");

    expect(main).toMatch(/const SETTLE_INITIAL_WAIT_MS = 62_000;/);
    expect(main).toMatch(/const SETTLE_MAX_ATTEMPTS = 1;/);
    expect(main).toMatch(/readRaw\("getPendingBet"/);
    expect(main).toMatch(/parseBetId\(mapField\(raw, "id"\)\) !== record\.betId/);
    expect(main).toMatch(/!addrEq\(mapField\(raw, "player"\), record\.player\)/);
    expect(main).toMatch(/mapField\(raw, "face"\)/);
    expect(main).toMatch(/mapField\(raw, "wager"\)/);
    expect(main).toMatch(/mapField\(raw, "settled"\)/);
    expect(main).toMatch(/rolled < 1 \|\|\s*\n\s*rolled > 6/);
    expect(main).toMatch(/won !== expectedWon/);
    expect(main).toMatch(/const expectedPayout = expectedWon \? \(wager \* 57n\) \/ 10n : 0n/);
    expect(main).toMatch(/payout !== expectedPayout/);
    expect(main).toMatch(/only the exact persisted record can[\s\S]*confirm the result/i);
    expect(main).not.toMatch(/revealFromSettledEvent/);
  });

  it("ships attributed art and a responsive warm game shell", () => {
    const styles = read("apps/dice-game/src/PlayArea.scss");
    const messages = read("apps/dice-game/src/locale/messages.ts");

    expect(exists("apps/dice-game/public/art/ATTRIBUTION.md")).toBe(true);
    expect(exists("apps/dice-game/public/art/hero-die.webp")).toBe(true);
    for (const fileName of [
      "chip-green.webp",
      "chip-blue.webp",
      "chip-red.webp",
      "chip-black.webp",
    ]) {
      expect(exists(`apps/dice-game/public/art/${fileName}`), fileName).toBe(true);
    }
    for (let face = 1; face <= 6; face += 1) {
      expect(exists(`apps/dice-game/public/art/die-white-${face}.webp`)).toBe(true);
    }

    expect(styles).toMatch(/\.dice-playarea \.mx2-stage\s*\{[\s\S]*min-height: 100dvh/);
    expect(styles).toMatch(/\.dice-stage-shell\s*\{[\s\S]*#fffaf0/);
    expect(styles).toMatch(/\.dice-stage-hud\s*\{/);
    expect(styles).toMatch(/\.dice-ingame-drawer\s*\{/);
    expect(styles).toMatch(/\.dice-a11y-controls:focus-within\s*\{/);
    expect(styles).toMatch(/@media \(max-width: 720px\)/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)/);

    for (const key of [
      "enableGameSound",
      "muteGameSound",
      "gameActionFailed",
      "guestRandomUnavailable",
      "guestFairnessShort",
      "guestRangeValue",
      "diceVrfRouteTitle",
      "vrfTrustLine",
    ]) {
      expect(messages, key).toMatch(new RegExp(`\\b${key}:`));
    }
    expect(messages).toMatch(/fixed three-block beacon/i);
    expect(messages).toMatch(/not presented as proof-carrying VRF/i);
  });
});
