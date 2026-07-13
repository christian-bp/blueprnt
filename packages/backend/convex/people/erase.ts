import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import {
  AUDIT_EVENTS,
  buildDeleteChanges,
  PERSON_AUDIT_FIELDS,
} from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation } from "../lib/functions"
import { pseudonymizePersonInSnapshots } from "../payMapping/erasure"

// Shared hard-delete body. Deletes payRecords, then personAssignments, then the
// people row, in child-first order. Throws notFound when the person is missing
// or belongs to another org. Returns the non-PII "before" snapshot so the
// caller (erasePersonAsOrg, an adminMutation) can write the audit row via
// ctx.audit.
//
// This is the SINGLE implementation of the delete. erasePersonAsOrg delegates
// here; there is no duplicate delete logic.
export async function erasePersonRecords(
  ctx: MutationCtx,
  orgId: string,
  personId: Id<"people">
): Promise<Record<string, unknown>> {
  const person = await ctx.db.get(personId)
  if (person === null || person.orgId !== orgId) {
    throw appError(ERROR_CODES.notFound)
  }
  // Captured before the deletes below: the people row (and with it
  // person.publicId) is gone after step 3.
  const personPublicId = person.publicId

  // Non-PII delete snapshot built BEFORE deletion. PERSON_AUDIT_FIELDS excludes
  // displayName, gender, birthDate, and externalRef (all person identifiers);
  // salary amounts never live on the people row.
  const nonPiiBefore: Record<string, unknown> = {
    employmentStartDate: person.employmentStartDate ?? null,
    ftePercent: person.ftePercent ?? null,
    country: person.country ?? null,
    isManager: person.isManager ?? null,
    statisticalCode: person.statisticalCode ?? null,
    department: person.department ?? null,
    archivedAt: person.archivedAt ?? null,
  }

  // 1. payRecords (child of people, by_person index).
  const payRows = await ctx.db
    .query("payRecords")
    .withIndex("by_person", (q) =>
      q.eq("orgId", orgId).eq("personId", personId)
    )
    .collect()
  for (const row of payRows) {
    await ctx.db.delete(row._id)
  }

  // 2. personAssignments (child of people, by_person index).
  const assignmentRows = await ctx.db
    .query("personAssignments")
    .withIndex("by_person", (q) =>
      q.eq("orgId", orgId).eq("personId", personId)
    )
    .collect()
  for (const row of assignmentRows) {
    await ctx.db.delete(row._id)
  }

  // 3. The people row itself.
  await ctx.db.delete(personId)

  // 4. Pseudonymize the person inside any frozen kartläggning snapshot
  //    (ADR-0011): the row stays, identity is tombstoned, aggregate kept.
  await pseudonymizePersonInSnapshots(ctx, orgId, personPublicId)

  return nonPiiBefore
}

// GDPR right to erasure: hard-deletes a person and all their associated data
// (payRecords, personAssignments) in child-first order so referential-style
// invariants are respected. The audit payload carries IDs ONLY (no name, gender,
// birthDate, email, salary amount) because the audit row itself must survive the
// erasure and GDPR requires the trail to be PII-free.
//
// This is the org-admin-gated HR entry point. adminMutation enforces org-admin
// role. Deletion is delegated to erasePersonRecords (the single implementation).
export const erasePersonAsOrg = adminMutation({
  args: { personId: v.id("people") },
  returns: v.null(),
  handler: async (ctx, { personId }) => {
    const nonPiiBefore = await erasePersonRecords(ctx, ctx.orgId, personId)
    await ctx.audit.log({
      type: AUDIT_EVENTS.personErased,
      payload: {
        personId,
        changes: buildDeleteChanges(nonPiiBefore, PERSON_AUDIT_FIELDS),
      },
    })
    return null
  },
})
