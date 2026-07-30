import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Files this repo carries a copy of, but does not own.
 *
 * neo-os-contracts is the source of truth for all three: the dotnet toolchain
 * helper, and the mock of the platform's generic game-oracle kernel that the
 * game tests deploy against. They are vendored rather than imported because the
 * repos ship no cross-repo package for shell libraries or xunit harness types.
 *
 * The checksums below are the upstream contents at the revision they were taken
 * from. Editing a vendored file here without pushing the change upstream - or an
 * upstream change that has not been pulled down - fails this test, so the two
 * copies cannot drift in silence. To land a real change: change it upstream,
 * copy it here, update the checksum.
 *
 * The same list, with the same checksums, is asserted in neo-os-contracts, so
 * an upstream edit fails there too until this repo catches up.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

const VENDORED = [
  {
    local: "scripts/lib/dotnet_tools.sh",
    upstream: "neo-os-contracts:scripts/lib/dotnet_tools.sh",
    sha256: "faf071a79217b7ab6acf1ea0e6e94d0e5cee2b75df8ef772f0206d86756fd2d6",
  },
  {
    local: "contracts/GameOracleMockFixture/GameOracleMockFixture.cs",
    upstream: "neo-os-contracts:contracts/GameOracleMockFixture/GameOracleMockFixture.cs",
    sha256: "64841aa903ea11d345b72bc2600f22bd75eb41ee349413106d21910bfc79cbff",
  },
  {
    local: "contracts/__tests__/GameOracleMockFixture.cs",
    upstream: "neo-os-contracts:contracts/__tests__/GameOracleMockFixture.cs",
    sha256: "722fab085890e2e4d9ee692012cd24a123d24b0f71f705f13580f4863e610a06",
  },
  {
    // The finalize result wire format: the kernel signs these bytes and the game
    // contracts parse them by offset, so the layout is the platform's to define
    // and a game may not change it unilaterally.
    local: "contracts/__tests__/GameResultCodec.cs",
    upstream: "neo-os-contracts:contracts/__tests__/GameResultCodec.cs",
    sha256: "aad23e19269a7fe5d01e12b4b6d39959532fff90bd95ba540ccf895baac19f18",
  },
  {
    local: "contracts/__tests__/ContractSourceAssertions.cs",
    upstream: "neo-os-contracts:contracts/__tests__/ContractSourceAssertions.cs",
    sha256: "a967925b77215018a506a7324b9bcf0f316d0e66e9bdd8420b88c528e48eecf9",
  },
];

const sha256 = (relative) =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(repoRoot, relative)))
    .digest("hex");

for (const entry of VENDORED) {
  test(`${entry.local} matches ${entry.upstream}`, () => {
    assert.equal(
      sha256(entry.local),
      entry.sha256,
      `${entry.local} no longer matches the copy in ${entry.upstream}. ` +
        `Make the change upstream first, copy it here, then update the checksum in this file.`,
    );
  });
}

test("every vendored file is present", () => {
  const missing = VENDORED.map((entry) => entry.local).filter(
    (relative) => !fs.existsSync(path.join(repoRoot, relative)),
  );
  assert.deepEqual(missing, [], "a vendored file went missing; the contract build cannot run without it");
});

/**
 * contracts/MiniApp.DevPack is the base library every app contract derives from.
 * All three repos carry a byte-identical copy: the app contracts compile against
 * it and there is no NuGet package to share it through.
 *
 * It is pinned as a whole directory rather than file by file, so adding or
 * removing a source file is caught too - a new base class present in one repo
 * and not the others is exactly the drift that would make an app contract
 * compile here and fail elsewhere.
 */
const DEVPACK_DIR = "contracts/MiniApp.DevPack";
const DEVPACK_FINGERPRINT =
  "fb494a5df6852361e0d21bfa0873efd5e84be6a9505ca71b6d9b90084b1ffe7d";

const devpackFingerprint = () => {
  const dir = path.join(repoRoot, DEVPACK_DIR);
  const names = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".cs") || name.endsWith(".csproj"))
    .sort();
  const hash = crypto.createHash("sha256");
  hash.update(names.join("\n") + "\n");
  for (const name of names) hash.update(fs.readFileSync(path.join(dir, name)));
  return hash.digest("hex");
};

test(`${DEVPACK_DIR} matches the copy in every other repo`, () => {
  assert.equal(
    devpackFingerprint(),
    DEVPACK_FINGERPRINT,
    `${DEVPACK_DIR} drifted. neo-os-contracts, neo-miniapps and neo-minigames each carry an ` +
      `identical copy; change it in all three in the same change, then update this fingerprint ` +
      `in each repo.`,
  );
});
