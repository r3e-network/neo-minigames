import { realpathSync } from "node:fs";
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
      // React must resolve to exactly one copy. The SDK packages declare react
      // as a peer, but an installer that gives them their own nested copy makes
      // components render against a different React than the test does, and
      // every hook then fails with "Cannot read properties of null (reading
      // 'useCallback')" - the dispatcher of the copy that is not rendering.
      react: resolve(repoRoot, "node_modules/react"),
      "react-dom": resolve(repoRoot, "node_modules/react-dom"),
      "react/jsx-runtime": resolve(repoRoot, "node_modules/react/jsx-runtime.js"),
      "react/jsx-dev-runtime": resolve(repoRoot, "node_modules/react/jsx-dev-runtime.js"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    fs: {
      // The SDK packages can resolve outside the project root (a workspace link
      // during development), and Vite's strict fs guard would deny reading their
      // assets.
      // realpath matters: during development the SDK packages are workspace
      // links, so the file Vite actually opens lives outside node_modules.
      allow: [
        repoRoot,
        resolve(repoRoot, "node_modules"),
        ...["@r3e-network/neo-miniapp-framework", "@r3e-network/neo-miniapp-shared"].flatMap(
          (pkg) => {
            const linked = resolve(repoRoot, "node_modules", pkg);
            try {
              return [linked, realpathSync(linked)];
            } catch {
              return [linked];
            }
          },
        ),
      ],
    },
  },
  test: {
    testTimeout: 30_000,
    environment: "jsdom",
    // Only the tests this repo's config actually owns. Apps that declare their
    // own `test` script bring their own vitest setup (asset stubs, audio and
    // physics shims), so those run in the app directory via `npm run test:apps`.
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
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
