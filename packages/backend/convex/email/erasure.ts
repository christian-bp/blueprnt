import { v } from "convex/values"
import { components } from "../_generated/api"
import { internalMutation } from "../_generated/server"

// GDPR erasure of a person's email PII: delete every message addressed to them
// (with its deliveries and events) from the Sweego email component. Scheduled by
// the platform erasure flow (platform/admin.deleteUser) so it commits with the
// erasure; the component then batches and self-reschedules until done. Kept in
// the email context so the platform module never reaches into the email
// provider directly. The component owns the actual deletion (tested there).
export const purgeRecipientEmails = internalMutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, { email }) => {
    await ctx.scheduler.runAfter(0, components.sweego.lib.purgeRecipient, {
      email,
    })
    return null
  },
})
