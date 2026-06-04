import react from "@vitejs/plugin-react"
import { baseConfig } from "@workspace/vitest-config/base"
import { defineProject, mergeConfig } from "vitest/config"

// reactConfig (happy-dom) is inlined here because the relative import inside
// packages/vitest-config/src/react.ts does not resolve under Node ESM when
// loaded by vitest from an app workspace. We replicate it to avoid the error.
export default mergeConfig(
  baseConfig,
  defineProject({
    plugins: [react()],
    resolve: {
      alias: {
        "@": new URL("./", import.meta.url).pathname,
        "@workspace/i18n/messages": new URL(
          "../../packages/i18n/messages",
          import.meta.url
        ).pathname,
      },
    },
    test: {
      environment: "happy-dom",
      server: {
        deps: {
          // next-intl uses package.json exports conditions that need inlining
          // under vitest's module resolver; see https://next-intl.dev/docs/environments/testing
          inline: ["next-intl"],
        },
      },
    },
  })
)
