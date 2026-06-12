import react from "@vitejs/plugin-react"
import { reactConfig } from "@workspace/vitest-config/react"
import { defineProject, mergeConfig } from "vitest/config"

export default mergeConfig(
  reactConfig,
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
