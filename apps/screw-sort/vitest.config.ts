import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@framework": path.resolve(__dirname, "../../node_modules/@r3e-network/neo-miniapp-framework"),
      "@shared": path.resolve(__dirname, "../../node_modules/@r3e-network/neo-miniapp-shared"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
  },
});
