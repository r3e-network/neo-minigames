import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const appsRoot = resolve(repoRoot, "apps");

/**
 * Per-app tests live in apps/tests/unit and reach their app by relative path
 * (`../../<slug>/src/...`) - the same depth below apps/ they had in the
 * monorepo, so those imports need no rewriting. @shared and @framework resolve
 * into node_modules now that the SDK is a published package.
 */
export default defineConfig({
  root: appsRoot,
  resolve: {
    alias: {
      "@framework": resolve(repoRoot, "node_modules/@r3e-network/neo-miniapp-framework"),
      "@shared": resolve(repoRoot, "node_modules/@r3e-network/neo-miniapp-shared"),
      phaser: resolve(repoRoot, "node_modules/phaser/dist/phaser.esm.js"),
    },
  },
  test: {
    testTimeout: 30_000,
    environment: "jsdom",
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx", "*/src/**/*.test.ts", "*/src/**/*.test.tsx"],
    // apps/tests/conformance is excluded from the default run; see
    // "test:conformance" in package.json.
    exclude: ["**/node_modules/**", "**/dist/**", "tests/conformance/**"],
    environmentOptions: { jsdom: { url: "http://localhost/" } },
    setupFiles: [resolve(appsRoot, "tests/test-utils/vitest-setup.ts")],
    server: {
      deps: {
        inline: ["@douyinfe/semi-icons", "@douyinfe/semi-ui", /@douyinfe\/semi-foundation/],
      },
    },
  },
});
