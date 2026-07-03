import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { internalMutation } from "../_generated/server"
import { AUDIT_EVENTS, buildCreateChanges, logAudit } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"

// The pay audit fields: ONLY non-sensitive fields are captured in the audit
// trail. Salary amounts (basicMonthly, variable, benefitInKind) are NEVER
// included (GDPR / Role != Person). The audit records THAT a salary was set
// for a person/year/source, never the value.
const PAY_AUDIT_FIELDS = ["payYear", "source", "currency"] as const

// Tenant-isolation assert for a point-read: throws notFound when the person
// does not exist or belongs to a different org.
async function requireOwnPerson(
  ctx: QueryCtx & { orgId: string },
  personId: Id<"people">
): Promise<Doc<"people">> {
  const person = await ctx.db.get(personId)
  if (person === null || person.orgId !== ctx.orgId) {
    throw appError(ERROR_CODES.notFound)
  }
  return person
}

// Wire shape returned by getSalaryHistory and getCurrentSalary.
const payRecordShape = v.object({
  payRecordId: v.id("payRecords"),
  personId: v.id("people"),
  payYear: v.number(),
  source: v.union(v.literal("import"), v.literal("manual")),
  basicMonthly: v.number(),
  currency: v.string(),
  variable: v.union(v.number(), v.null()),
  benefitInKind: v.union(v.number(), v.null()),
  effectiveAt: v.number(),
  createdAt: v.number(),
})

function toPayRecordShape(doc: Doc<"payRecords">) {
  return {
    payRecordId: doc._id,
    personId: doc.personId,
    payYear: doc.payYear,
    source: doc.source,
    basicMonthly: doc.basicMonthly,
    currency: doc.currency,
    variable: doc.variable ?? null,
    benefitInKind: doc.benefitInKind ?? null,
    effectiveAt: doc.effectiveAt,
    createdAt: doc.createdAt,
  }
}

// Append a pay record row for a person (manual entry by HR). Each call always
// inserts a new row: a raise is a new record, never an overwrite. The existing
// history is preserved and returned by getSalaryHistory.
//
// Audit: pay.salarySet with an AMOUNT-FREE payload (GDPR). Only payYear,
// source, and currency are captured in the changes diff.
export const setSalary = orgMutation({
  args: {
    personId: v.id("people"),
    payYear: v.number(),
    basicMonthly: v.number(),
    currency: v.string(),
    variable: v.optional(v.number()),
    benefitInKind: v.optional(v.number()),
    effectiveAt: v.optional(v.number()),
  },
  returns: v.id("payRecords"),
  handler: async (ctx, args) => {
    // Assert the person belongs to the caller's org.
    await requireOwnPerson(ctx, args.personId)

    const effectiveAt = args.effectiveAt ?? Date.now()
    const createdAt = Date.now()

    const payRecordId = await ctx.db.insert("payRecords", {
      orgId: ctx.orgId,
      personId: args.personId,
      payYear: args.payYear,
      source: "manual",
      basicMonthly: args.basicMonthly,
      currency: args.currency,
      ...(args.variable !== undefined ? { variable: args.variable } : {}),
      ...(args.benefitInKind !== undefined
        ? { benefitInKind: args.benefitInKind }
        : {}),
      effectiveAt,
      createdAt,
    })

    // GDPR: the audit payload contains ONLY non-sensitive fields. Salary
    // amounts are never stored in the audit trail.
    const snapshot: Record<string, unknown> = {
      payYear: args.payYear,
      source: "manual",
      currency: args.currency,
    }

    await ctx.audit.log({
      type: AUDIT_EVENTS.salarySet,
      payload: {
        personId: args.personId,
        changes: buildCreateChanges(snapshot, PAY_AUDIT_FIELDS),
      },
    })

    return payRecordId
  },
})

// Internal mutation for the payroll-import path. Inserts a pay record row
// with source "import". Uses the free-function logAudit (internal mutations
// have no ctx.audit). Amount-free audit payload (same GDPR rule as setSalary).
export const appendSalary = internalMutation({
  args: {
    orgId: v.string(),
    actorId: v.string(),
    personId: v.id("people"),
    payYear: v.number(),
    basicMonthly: v.number(),
    currency: v.string(),
    variable: v.optional(v.number()),
    benefitInKind: v.optional(v.number()),
    effectiveAt: v.optional(v.number()),
  },
  returns: v.id("payRecords"),
  handler: async (ctx, args) => {
    // Verify person exists in the given org before inserting.
    const person = await ctx.db.get(args.personId)
    if (person === null || person.orgId !== args.orgId) {
      throw appError(ERROR_CODES.notFound)
    }

    const effectiveAt = args.effectiveAt ?? Date.now()
    const createdAt = Date.now()

    const payRecordId = await ctx.db.insert("payRecords", {
      orgId: args.orgId,
      personId: args.personId,
      payYear: args.payYear,
      source: "import",
      basicMonthly: args.basicMonthly,
      currency: args.currency,
      ...(args.variable !== undefined ? { variable: args.variable } : {}),
      ...(args.benefitInKind !== undefined
        ? { benefitInKind: args.benefitInKind }
        : {}),
      effectiveAt,
      createdAt,
    })

    // GDPR: amount-free audit payload.
    const snapshot: Record<string, unknown> = {
      payYear: args.payYear,
      source: "import",
      currency: args.currency,
    }

    await logAudit(ctx, {
      orgId: args.orgId,
      type: AUDIT_EVENTS.salarySet,
      actorId: args.actorId,
      payload: {
        personId: args.personId,
        changes: buildCreateChanges(snapshot, PAY_AUDIT_FIELDS),
      },
    })

    return payRecordId
  },
})

// Returns all pay records for a person ordered by effectiveAt descending
// (most recent first). Returns an empty array when the person does not belong
// to this org.
export const getSalaryHistory = orgQuery({
  args: { personId: v.id("people") },
  returns: v.array(payRecordShape),
  handler: async (ctx, { personId }) => {
    const person = await ctx.db.get(personId)
    if (person === null || person.orgId !== ctx.orgId) return []

    const rows = await ctx.db
      .query("payRecords")
      .withIndex("by_person", (q) =>
        q.eq("orgId", ctx.orgId).eq("personId", personId)
      )
      .collect()

    // Sort most recent effectiveAt first.
    rows.sort((a, b) => b.effectiveAt - a.effectiveAt)
    return rows.map(toPayRecordShape)
  },
})

// Returns the pay record with the greatest effectiveAt <= asOf, i.e. the
// salary active at the given reference timestamp. The caller supplies asOf
// (live UI passes its current client time; a report passes its as-of date).
// Returns null when no records exist for this person or when the person does
// not belong to this org.
export const getCurrentSalary = orgQuery({
  args: { personId: v.id("people"), asOf: v.number() },
  returns: v.union(payRecordShape, v.null()),
  handler: async (ctx, { personId, asOf }) => {
    const person = await ctx.db.get(personId)
    if (person === null || person.orgId !== ctx.orgId) return null

    const rows = await ctx.db
      .query("payRecords")
      .withIndex("by_person", (q) =>
        q.eq("orgId", ctx.orgId).eq("personId", personId)
      )
      .collect()

    // Find the row with the greatest effectiveAt that is <= asOf.
    let current: Doc<"payRecords"> | null = null
    for (const row of rows) {
      if (row.effectiveAt <= asOf) {
        if (current === null || row.effectiveAt > current.effectiveAt) {
          current = row
        }
      }
    }

    return current !== null ? toPayRecordShape(current) : null
  },
})
