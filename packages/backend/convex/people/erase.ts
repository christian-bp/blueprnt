import { v } from "convex/values"
import {
  AUDIT_EVENTS,
  buildDeleteChanges,
  PERSON_AUDIT_FIELDS,
} from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation } from "../lib/functions"

// GDPR right to erasure: hard-deletes a person and all their associated data
// (payRecords, personAssignments) in child-first order so referential-style
// invariants are respected. The audit payload carries IDs ONLY (no name, gender,
// birthDate, email, salary amount) because the audit row itself must survive the
// erasure and GDPR requires the trail to be PII-free.
//
// This is a dedicated admin action on a personId. It is NOT the self-service
// eraseSelf / platform deleteUser flows (those erase app-user identities; people
// rows are not linked to app users in V2). adminMutation enforces org-admin role.
export const erasePerson = adminMutation({
  args: { personId: v.id("people") },
  returns: v.null(),
  handler: async (ctx, { personId }) => {
    // Tenant isolation: assert the person belongs to the caller's org.
    const person = await ctx.db.get(personId)
    if (person === null || person.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }

    // Build the non-PII delete snapshot BEFORE deleting the row. PERSON_AUDIT_FIELDS
    // explicitly excludes displayName, gender, and birthDate (PII). Salary amounts
    // never live on the people row — they live on payRecords and are not captured
    // in this audit row (the payRecords rows are deleted, not audited per-row).
    const nonPiiBefore: Record<string, unknown> = {
      externalRef: person.externalRef ?? null,
      employmentStartDate: person.employmentStartDate ?? null,
      ftePercent: person.ftePercent ?? null,
      country: person.country ?? null,
      isManager: person.isManager ?? null,
      statisticalCode: person.statisticalCode ?? null,
      department: person.department ?? null,
      archivedAt: person.archivedAt ?? null,
    }

    // 1. Delete all payRecords for this person (child of people, by_person index).
    const payRows = await ctx.db
      .query("payRecords")
      .withIndex("by_person", (q) =>
        q.eq("orgId", ctx.orgId).eq("personId", personId)
      )
      .collect()
    for (const row of payRows) {
      await ctx.db.delete(row._id)
    }

    // 2. Delete all personAssignments for this person (child of people, by_person index).
    const assignmentRows = await ctx.db
      .query("personAssignments")
      .withIndex("by_person", (q) =>
        q.eq("orgId", ctx.orgId).eq("personId", personId)
      )
      .collect()
    for (const row of assignmentRows) {
      await ctx.db.delete(row._id)
    }

    // 3. Hard-delete the people row itself.
    await ctx.db.delete(personId)

    // 4. Audit the erasure. Payload: personId (internal key only) + non-PII
    // delete changes. No name/email/gender/birthDate/salary amount, ever.
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
