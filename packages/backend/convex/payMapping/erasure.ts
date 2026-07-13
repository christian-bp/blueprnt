import type { MutationCtx } from "../_generated/server"
import { ERASED_ACTOR_NAME } from "../lib/audit"

// GDPR (ADR-0011): pseudonymize an erased person inside every immutable snapshot
// row (tombstone the name, clear the birth date) while KEEPING the aggregate
// (gender, role/band/level, pay) so the statutory evidence document survives.
export async function pseudonymizePersonInSnapshots(
  ctx: MutationCtx,
  orgId: string,
  personPublicId: string
): Promise<void> {
  const rows = await ctx.db
    .query("payMappingSnapshotRows")
    .withIndex("by_org_person", (q) =>
      q.eq("orgId", orgId).eq("personPublicId", personPublicId)
    )
    .collect()
  for (const row of rows) {
    await ctx.db.patch(row._id, {
      erased: true,
      displayName: ERASED_ACTOR_NAME,
      birthDate: undefined,
    })
  }
}
