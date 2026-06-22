import { describe, expect, it } from "vitest"
import { internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

const enqueueArgs = {
  to: "invitee@example.com",
  templateKey: "invitation" as const,
  props: {
    inviterName: "Anna",
    organizationName: "Acme",
    acceptUrl: "https://x.example/accept-invitation/inv_1",
  },
  locale: "en",
}

// Delivery, retries, idempotency, and tracking now live in the Sweego component
// (tested in that package). Here we just verify the transactional hand-off:
// enqueueEmail schedules the deliver action that renders + sends via Sweego.
describe("email outbox", () => {
  it("enqueueEmail transactionally schedules a deliver action", async () => {
    const t = initConvexTest()
    await t.mutation(internal.email.outbox.enqueueEmail, enqueueArgs)
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    )
    expect(scheduled).toHaveLength(1)
    expect(scheduled[0].name).toContain("email/outbox")
  })
})
