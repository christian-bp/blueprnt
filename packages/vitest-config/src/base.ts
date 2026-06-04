import { defineConfig } from "vitest/config"

// Shared defaults for every package. Per-package configs use
// mergeConfig(baseConfig, defineProject({ ... })).
export const baseConfig = defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/_generated/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
    },
  },
})
