import { mergeConfig } from "vitest/config"
import { baseConfig } from "./base"

// For packages/apps that test React components with Testing Library.
export const reactConfig = mergeConfig(baseConfig, {
  test: {
    environment: "happy-dom",
  },
})
