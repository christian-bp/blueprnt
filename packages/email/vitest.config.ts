import { defineProject, mergeConfig } from "vitest/config"
import { baseConfig } from "@workspace/vitest-config/base"

export default mergeConfig(
  baseConfig,
  defineProject({
    test: {
      coverage: {
        thresholds: {
          lines: 95,
          functions: 95,
          branches: 85,
          statements: 95,
        },
      },
    },
  })
)
