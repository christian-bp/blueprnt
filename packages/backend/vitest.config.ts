import { defineProject, mergeConfig } from "vitest/config"
import { baseConfig } from "@workspace/vitest-config/base"

export default mergeConfig(
  baseConfig,
  defineProject({
    test: {
      environment: "edge-runtime",
      server: { deps: { inline: ["convex-test"] } },
      // Drain in-flight scheduled functions after each test (see test.setup.ts)
      // so background work (the unregistered Sweego deliver) does not log during
      // worker teardown and fail the run with an unhandled rpc-teardown error.
      setupFiles: ["./convex/test.setup.ts"],
      // Write console output directly instead of through the worker rpc. The
      // afterEach drain above settles scheduled work inside each test, but
      // the drain of a file's LAST test can itself emit the
      // unregistered-Sweego stderr, and on a slow runner that log is still
      // in flight over the rpc when the worker tears down: vitest records an
      // unhandled "Closing rpc while onUserConsoleLog was pending" and fails
      // a run whose every test passed (seen on CI). Direct writes cannot
      // race the channel; they also stop vitest swallowing backend console
      // output.
      disableConsoleIntercept: true,
      // Test-only flag read by component seed functions (betterAuth/testing.ts)
      // to fail closed on the real deployment. convex-test runs functions in
      // this same process, so process.env.CONVEX_TEST is visible to them here;
      // it is never set on the live Convex deployment, so the seeds throw there.
      // SITE_URL lets createAuth(ctx) construct under tests (auth.ts requires it
      // for baseURL); the value is arbitrary since no test makes real HTTP auth
      // calls. It exercises the password gate's fail-closed path in account.ts.
      env: { CONVEX_TEST: "true", SITE_URL: "http://localhost" },
    },
  })
)
