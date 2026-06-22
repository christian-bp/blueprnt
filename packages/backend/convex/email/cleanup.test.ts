import { describe, expect, it } from "vitest"
import { internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

// cleanup.run is blueprnt-owned wiring: it schedules the Sweego component's three
// retention prunes with specific olderThan cutoffs (the documented PII retention
// bound). The component owns the deletion (tested there); here we lock the
// contract that all three are scheduled with the right durations, so a dropped
// call or a swapped cutoff is caught (typecheck cannot: olderThan is optional).
describe("email cleanup cron", () => {
  it("schedules the three Sweego retention prunes with the right cutoffs", async () => {
    const t = initConvexTest()
    await t.mutation(internal.email.cleanup.run, {})
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    )
    expect(scheduled).toHaveLength(3)
    // Three distinct component mutations (messages / abandoned / events).
    expect(new Set(scheduled.map((s) => s.name)).size).toBe(3)
    // Cutoffs: messages 1 week, events 1 week, abandoned 4 weeks.
    const cutoffs = scheduled
      .map((s) => (s.args[0] as { olderThan: number }).olderThan)
      .sort((a, b) => a - b)
    expect(cutoffs).toEqual([ONE_WEEK_MS, ONE_WEEK_MS, 4 * ONE_WEEK_MS])
  })
})
