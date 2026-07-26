#!/usr/bin/env node
/**
 * contracts/MiniApp.DevPack is source-included by this repo's contract projects
 * (`<Compile Include="../MiniApp.DevPack/...">`) because Neo contracts compile
 * their base classes in rather than linking a DLL - there is no package form to
 * depend on. That means the DevPack is vendored here, and a vendored copy can
 * drift from the platform's canonical one.
 *
 * This compares every vendored file against neo-miniapps-platform@master and
 * fails on any difference, so drift surfaces in CI instead of at deploy time.
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const devPackDir = path.join(repoRoot, "contracts", "MiniApp.DevPack");
const RAW_BASE =
  process.env.DEVPACK_UPSTREAM_BASE ||
  "https://raw.githubusercontent.com/r3e-network/neo-miniapps-platform/master/contracts/MiniApp.DevPack";

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

const localNames = (await fs.readdir(devPackDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort();

const drift = [];
for (const name of localNames) {
  const local = await fs.readFile(path.join(devPackDir, name));
  const response = await fetch(`${RAW_BASE}/${encodeURIComponent(name)}`);
  if (!response.ok) {
    drift.push({ file: name, reason: `upstream fetch failed with HTTP ${response.status}` });
    continue;
  }
  const upstream = Buffer.from(await response.arrayBuffer());
  if (sha256(local) !== sha256(upstream)) {
    drift.push({ file: name, reason: "content differs from platform master" });
  }
}

console.log(JSON.stringify({ checked: localNames.length, drift_count: drift.length, drift }, null, 2));
if (drift.length > 0) process.exit(1);
