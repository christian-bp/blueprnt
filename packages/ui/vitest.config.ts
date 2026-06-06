import react from "@vitejs/plugin-react"
import { reactConfig } from "@workspace/vitest-config/react"
import { defineProject, mergeConfig } from "vitest/config"

// Covers the first-party files in src/ (flag.tsx). The shadcn vendor dirs
// (src/components, src/hooks, src/lib, src/styles) are untested by policy.
export default mergeConfig(
  reactConfig,
  defineProject({
    plugins: [react()],
    resolve: {
      alias: {
        "@workspace/ui": new URL("./src", import.meta.url).pathname,
      },
    },
  })
)
