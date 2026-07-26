#!/usr/bin/env node
/**
 * Builds every app in this repo with Vite, in slug order.
 *
 * Each app is an independent SPA whose output is what gets published to the
 * CDN, so a failure in one app must not silently produce a partial release:
 * every failure is collected and the process exits non-zero.
 *
 * Usage:
 *   node scripts/build-all.mjs              # all apps
 *   node scripts/build-all.mjs game-2048    # selected apps
 */
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appsRoot = path.join(repoRoot, "apps");
const selected = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith("-")));
const NON_APP_DIRS = new Set(["tests"]);

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function runBuild(appDir) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["vite", "build"], { cwd: appDir, stdio: "pipe", env: process.env });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.on("close", (code) => resolve({ code, output }));
  });
}

const entries = await fs.readdir(appsRoot, { withFileTypes: true });
const apps = [];
for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
  if (!entry.isDirectory() || NON_APP_DIRS.has(entry.name)) continue;
  if (selected.size > 0 && !selected.has(entry.name)) continue;
  const appDir = path.join(appsRoot, entry.name);
  if (!(await exists(path.join(appDir, "neo-manifest.json")))) continue;
  apps.push({ slug: entry.name, appDir });
}

const failures = [];
for (const app of apps) {
  process.stdout.write(`[build] ${app.slug}\n`);
  const result = await runBuild(app.appDir);
  if (result.code !== 0) {
    failures.push({ slug: app.slug, tail: result.output.split(/\r?\n/).slice(-40).join("\n") });
    process.stdout.write(`[build] ${app.slug} FAILED\n`);
  }
}

console.log(JSON.stringify({ built: apps.length - failures.length, failed: failures.length, failures }, null, 2));
if (failures.length > 0) process.exit(1);
