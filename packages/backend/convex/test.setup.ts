import { afterEach } from "vitest"
import { drainScheduledFunctions } from "./testing.helpers"

// Drain in-flight scheduled functions after every test. Background scheduled
// work (e.g. the unregistered Sweego email deliver) otherwise logs its failure
// asynchronously and can race the vitest worker teardown, which surfaces as an
// unhandled "Closing rpc while onUserConsoleLog was pending" and fails the run.
// Running the drain here settles that work inside the test lifecycle.
afterEach(async () => {
  await drainScheduledFunctions()
})
