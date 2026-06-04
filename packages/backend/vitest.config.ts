import { defineProject, mergeConfig } from "vitest/config"
import { baseConfig } from "@workspace/vitest-config/base"

export default mergeConfig(
  baseConfig,
  defineProject({
    test: {
      environment: "edge-runtime",
      server: { deps: { inline: ["convex-test"] } },
      // Test-only flag read by component seed functions (betterAuth/testing.ts)
      // to fail closed on the real deployment. convex-test runs functions in
      // this same process, so process.env.CONVEX_TEST is visible to them here;
      // it is never set on the live Convex deployment, so the seeds throw there.
      env: { CONVEX_TEST: "true" },
    },
  })
)
