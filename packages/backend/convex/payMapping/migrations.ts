import { v } from "convex/values"
import { internalMutation } from "../_generated/server"

// One-shot backfill for the estimatedCostUnit addition: rows created before
// the unit existed carry a bare amount, which always meant a lump sum, so
// they become explicit "oneOff" rows. Paged (the org-scaled-writes
// convention): each call handles one page and returns the cursor to continue
// from; the operator repeats with the returned cursor until isDone. Delete
// this file once every deployment has run it (a migration is evidence only
// while it is needed).
const BATCH = 500

export const backfillActionCostUnit = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.object({
    patched: v.number(),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("payMappingActions")
      .paginate({ numItems: BATCH, cursor: cursor ?? null })
    let patched = 0
    for (const row of page.page) {
      if (
        row.estimatedCost !== undefined &&
        row.estimatedCostUnit === undefined
      ) {
        await ctx.db.patch(row._id, { estimatedCostUnit: "oneOff" })
        patched += 1
      }
    }
    return {
      patched,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    }
  },
})
