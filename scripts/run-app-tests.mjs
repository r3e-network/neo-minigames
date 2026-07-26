#!/usr/bin/env node
/**
 * Aggregate runner for per-app test suites.
 *
 * Apps that declare their own `test` script own their vitest config - jsdom
 * mocks, asset stubs, physics and audio shims. Running those files from the
 * repo-level config instead would fail on setup the app config provides, so
 * each suite runs in its own directory exactly as it did in the monorepo.
 *
 * Suites run in parallel with bounded concurrency, output is buffered so logs
 * do not interleave, and every suite runs even if some fail - a failure is
 * reported by app name rather than reduced to an anonymous count.
 */
import { spawn } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "apps");
const NON_APP_DIRS = new Set(["tests"]);
const selected = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith("-")));

function findAppsWithTests() {
  const out = [];
  for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || NON_APP_DIRS.has(entry.name)) continue;
    if (selected.size > 0 && !selected.has(entry.name)) continue;
    const pkgPath = path.join(appsDir, entry.name, "package.json");
    if (!existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      if (typeof pkg.scripts?.test === "string") {
        out.push({ name: entry.name, dir: path.join(appsDir, entry.name) });
      }
    } catch {
      // Unparseable package.json is a separate concern; skip rather than abort.
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function runSuite(app) {
  return new Promise((resolve) => {
    const child = spawn("npm", ["test", "--silent"], { cwd: app.dir, stdio: ["ignore", "pipe", "pipe"] });
    const chunks = [];
    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => chunks.push(d));
    child.on("close", (code) =>
      resolve({ name: app.name, ok: code === 0, output: Buffer.concat(chunks).toString("utf8") }),
    );
  });
}

const apps = findAppsWithTests();
if (apps.length === 0) {
  console.log("[app-tests] no app declares a test script");
  process.exit(0);
}

const concurrency = Math.max(1, Math.min(apps.length, os.cpus().length - 1 || 1));
const queue = [...apps];
const failures = [];

async function worker() {
  for (;;) {
    const app = queue.shift();
    if (!app) return;
    const result = await runSuite(app);
    console.log(`\n===== ${result.name} ${result.ok ? "PASS" : "FAIL"} =====`);
    if (!result.ok) {
      console.log(result.output);
      failures.push(result.name);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));

console.log(`\n[app-tests] ${apps.length - failures.length}/${apps.length} suites passed`);
if (failures.length > 0) {
  console.log(`[app-tests] failing: ${failures.join(", ")}`);
  process.exit(1);
}
