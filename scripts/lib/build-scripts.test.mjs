import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Rules the contract build entrypoints have to keep.
 *
 * MiniAppTarotVrf only passes its tests when compiled by Neo.Compiler.CSharp
 * 3.9.1 with --checked. contracts/build.sh compiles everything it finds with
 * whichever nccs is on the machine, so building the VRF contract there silently
 * replaces a good artifact with one that loads and then fails at runtime - which
 * is how it broke when this repo was split out. The two rules below keep that
 * from coming back: build.sh must skip it, and build_tarot_vrf.sh must keep the
 * pin.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), "utf8");

const PINNED_PROJECTS = ["MiniAppTarotVrf", "TarotOracleMockFixture"];

test("build_tarot_vrf.sh pins Neo.Compiler.CSharp 3.9.1 and fails on any other version", () => {
  const body = read("scripts/build_tarot_vrf.sh");

  assert.match(body, /NCCS/, "the NCCS override must keep working");
  assert.match(body, /3\.9\.1/, "MiniAppTarotVrf must stay pinned to Neo.Compiler.CSharp 3.9.1");
  assert.match(
    body,
    /!=\s*3\.9\.1\*/,
    "the version check must reject a compiler that is not 3.9.1 rather than warn",
  );
  assert.match(body, /--checked/, "the pinned build must keep --checked");
});

test("build_tarot_vrf.sh builds every project the generic build skips", () => {
  const body = read("scripts/build_tarot_vrf.sh");
  for (const project of PINNED_PROJECTS) {
    assert.match(
      body,
      new RegExp(`contracts/${project}/${project}\\.csproj`),
      `${project} is skipped by contracts/build.sh, so this script has to build it`,
    );
  }
});

test("contracts/build.sh skips the projects that need the pinned compiler", () => {
  const body = read("contracts/build.sh");
  for (const project of PINNED_PROJECTS) {
    assert.match(
      body,
      new RegExp(`^\\s*${project}\\s*$`, "m"),
      `contracts/build.sh must list ${project} as skipped, or it will overwrite the pinned artifact`,
    );
  }
  assert.match(
    body,
    /is_tarot_vrf_project/,
    "the skip list must actually be consulted in the build loop",
  );
});
