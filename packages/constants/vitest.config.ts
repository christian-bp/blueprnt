import { baseConfig } from "@workspace/vitest-config/base"
import { defineProject, mergeConfig } from "vitest/config"

export default mergeConfig(baseConfig, defineProject({}))
