import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import {
  anonymizePersonAuditRows,
  AUDIT_EVENTS,
  buildDeleteChanges,
  PERSON_ERASURE_AUDIT_FIELDS,
  personAuditFields,
} from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation } from "../lib/functions"
import { pseudonymizePersonInSnapshots } from "../payMapping/erasure"

// Shared hard-delete body. Deletes payRecords, then personAssignments, then the
// people row, in child-first order, then pseudonymizes the person inside the two
// retained records (the frozen pay-mapping snapshot and the audit trail).
// Throws notFound when the person is missing or belongs to another org. Returns
// the identity-free "before" snapshot so the caller (erasePersonAsOrg, an
// adminMutation) can write the audit row via ctx.audit.
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

  // Identity-free delete snapshot built BEFORE deletion.
  // PERSON_ERASURE_AUDIT_FIELDS is PERSON_AUDIT_FIELDS minus the identity
  // fields, so the row written AT erasure never captures the name, gender,
  // employee number, birth date, or job title this very mutation is scrubbing
  // out of the older rows; salary amounts never live on the people row.
  const identityFreeBefore = personAuditFields(
    person,
    PERSON_ERASURE_AUDIT_FIELDS
  )

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

  // 5. Tombstone the person's identity values inside the retained audit trail
  //    (ADR-0013): person.* diffs record name/gender/employee number/birth
  //    date/job title, so the same anonymize-not-retain rule applies here as to
  //    the frozen snapshot above. The rows stay (legitimate interest), their
  //    identity values and derived searchText do not.
  await anonymizePersonAuditRows(ctx, orgId, personId)

  return identityFreeBefore
}

// GDPR right to erasure: hard-deletes a person and all their associated data
// (payRecords, personAssignments) in child-first order so referential-style
// invariants are respected. The audit payload this writes carries IDs and
// structural fields ONLY (no name, gender, birthDate, employee number, job
// title, email, salary amount), and erasePersonRecords has already tombstoned
// those values in the person's EARLIER rows, so the surviving trail holds no
// personal data about the erased individual.
//
// This is the org-admin-gated HR entry point. adminMutation enforces org-admin
// role. Deletion is delegated to erasePersonRecords (the single implementation).
export const erasePersonAsOrg = adminMutation({
  args: { personId: v.id("people") },
  returns: v.null(),
  handler: async (ctx, { personId }) => {
    const identityFreeBefore = await erasePersonRecords(
      ctx,
      ctx.orgId,
      personId
    )
    await ctx.audit.log({
      type: AUDIT_EVENTS.personErased,
      payload: {
        personId,
        changes: buildDeleteChanges(
          identityFreeBefore,
          PERSON_ERASURE_AUDIT_FIELDS
        ),
      },
    })
    return null
  },
})
