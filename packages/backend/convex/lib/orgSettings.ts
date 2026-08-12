import type { Doc } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"

// The single home for "the org's settings row". requireCompleteSettings
// (ai/suggest.ts) layers its completeness demands on top; the assistant
// treats every field as optional.
export async function orgSettingsRow(
  ctx: QueryCtx | MutationCtx,
  orgId: string
): Promise<Doc<"organizations"> | null> {
  return await ctx.db
    .query("organizations")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique()
}
