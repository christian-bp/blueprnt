import type { MutationCtx } from "../_generated/server"
import { ERASED_ACTOR_NAME } from "../lib/audit"

// GDPR (ADR-0011): pseudonymize an erased person inside every immutable snapshot
// row (tombstone the name, clear the birth date) while KEEPING the aggregate
// (gender, role/level/seniority, pay) so the statutory evidence document survives.
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

// GDPR (ADR-0027): tombstone the erased person's work-layer rows (actions and
// notes whose target is the individual). The user-written free text is the
// risk here: it can name the person, and no field-key scrub reaches prose, so
// it is cleared outright and the row flagged. The row itself, with status,
// cost, dates and target, stays: the action plan's statutory evaluation must
// not be falsified by an erasure. target.personPublicId is kept deliberately:
// it is a pseudonym whose display value pseudonymizePersonInSnapshots has
// already tombstoned, so keeping it makes every surface render the row as the
// tombstone, while removing it would only break that resolution. These
// patches bypass the completed-run content lock on purpose: erasure is a
// legal duty, not user-initiated editing.
export async function tombstonePersonInWorkLayer(
  ctx: MutationCtx,
  orgId: string,
  personPublicId: string
): Promise<void> {
  const actionRows = await ctx.db
    .query("payMappingActions")
    .withIndex("by_org_person", (q) =>
      q.eq("orgId", orgId).eq("target.personPublicId", personPublicId)
    )
    .collect()
  for (const row of actionRows) {
    await ctx.db.patch(row._id, {
      erased: true,
      problem: "",
      plannedAction: "",
    })
  }

  const noteRows = await ctx.db
    .query("payMappingNotes")
    .withIndex("by_org_person", (q) =>
      q.eq("orgId", orgId).eq("target.personPublicId", personPublicId)
    )
    .collect()
  for (const row of noteRows) {
    await ctx.db.patch(row._id, { erased: true, text: "" })
  }
}
