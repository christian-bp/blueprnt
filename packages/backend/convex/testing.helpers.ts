/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import authSchema from "./betterAuth/schema"
import schema from "./schema"

// Register the LOCAL betterAuth component with OUR generated schema.
// Do not use @convex-dev/better-auth/test: it registers the package's
// bundled schema, which does not include our org tables/indexes.
export function initConvexTest() {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"))
  t.registerComponent(
    "betterAuth",
    authSchema,
    import.meta.glob("./betterAuth/**/*.ts")
  )
  return t
}
