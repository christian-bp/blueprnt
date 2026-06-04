import { defineProject, mergeConfig } from "vitest/config"
import { baseConfig } from "@workspace/vitest-config/base"

export default mergeConfig(
  baseConfig,
  defineProject({
    test: {
      environment: "edge-runtime",
      server: { deps: { inline: ["convex-test"] } },
    },
  })
)
