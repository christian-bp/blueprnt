/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import authSchema from "./betterAuth/schema"
import schema from "./schema"

// Every t created in a test, so the global afterEach (test.setup.ts) can drain
// their in-flight scheduled functions before the vitest worker tears down.
// convex-test runs runAfter(0) work (e.g. the email deliver action) in the
// background; that work is intentionally NOT wired to Sweego in tests (see
// email/outbox.ts), so it fails and logs asynchronously. If a completion log is
// still in flight at worker teardown, vitest throws an unhandled
// "Closing rpc while onUserConsoleLog was pending" and fails the run even though
// every test passed. Draining flushes those logs inside the test lifecycle.
const liveTests: ReturnType<typeof convexTest>[] = []

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
  liveTests.push(t)
  return t
}

// Settle any background scheduled functions started during the test so their
// success/failure logs complete now instead of racing worker teardown. Their
// failure is expected (Sweego is not registered in tests) and is not a test
// failure, so swallow it: finishInProgressScheduledFunctions already resolves on
// failure, and the try/catch guards any stray rejection.
export async function drainScheduledFunctions() {
  for (const t of liveTests.splice(0)) {
    try {
      await t.finishInProgressScheduledFunctions()
    } catch {
      // Background job failure is logged by convex-test; not a test failure.
    }
  }
}
