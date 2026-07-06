import { v } from "convex/values"
import { totalMonthlyComp } from "@workspace/constants"
import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { internalMutation } from "../_generated/server"
import {
  AUDIT_EVENTS,
  buildChanges,
  buildCreateChanges,
  logAudit,
} from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"
import { assignmentActiveAt } from "./assignments"

// The pay audit fields: ONLY non-sensitive fields are captured in the audit
// trail. Salary amounts (basicMonthly, components) are NEVER included
// (GDPR / Role != Person). The audit records THAT a salary was set for a
// person/year/source, never the value.
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

// Validator for a single compensation component.
const payComponentValidator = v.object({
  kind: v.string(),
  monthlyAmount: v.number(),
})

// Wire fields shared by getSalaryHistory and getCurrentSalary (one source of
// truth so the two shapes cannot drift).
const payRecordFields = {
  payRecordId: v.id("payRecords"),
  personId: v.id("people"),
  payYear: v.number(),
  source: v.union(v.literal("import"), v.literal("manual")),
  basicMonthly: v.number(),
  currency: v.string(),
  components: v.array(payComponentValidator),
  // Derived: basicMonthly + sum(components[*].monthlyAmount). Computed on read,
  // never stored, so it stays consistent without a migration.
  totalMonthlyComp: v.number(),
  effectiveAt: v.number(),
  createdAt: v.number(),
}

const payRecordShape = v.object(payRecordFields)

// History rows additionally carry the role + level the salary was earned
// under: the assignment active at the record's effectiveAt, joined on read
// via assignmentActiveAt (derived, never stored; ADR-0002 spirit). Null when
// the person had no assignment yet at that time (e.g. salary imported before
// the first classification).
const salaryHistoryShape = v.object({
  ...payRecordFields,
  assignment: v.union(
    v.object({ roleId: v.id("roles"), level: v.string() }),
    v.null()
  ),
})

function toPayRecordShape(doc: Doc<"payRecords">) {
  return {
    payRecordId: doc._id,
    personId: doc.personId,
    payYear: doc.payYear,
    source: doc.source,
    basicMonthly: doc.basicMonthly,
    currency: doc.currency,
    components: doc.components,
    totalMonthlyComp: totalMonthlyComp(doc.basicMonthly, doc.components),
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
    components: v.array(payComponentValidator),
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
      components: args.components,
      effectiveAt,
      createdAt,
    })

    // GDPR: the audit payload contains ONLY non-sensitive fields. Salary
    // amounts (basicMonthly, components) are never stored in the audit trail.
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

// Hard-delete a single pay record (correcting a wrong year or a bad import
// row). Same permission tier as setSalary: whoever may enter a salary may
// correct one.
//
// Audit: pay.salaryDeleted with the same AMOUNT-FREE payload rule as
// salarySet (GDPR: the trail records THAT a person/year/source record was
// removed, never the value); the diff runs from the snapshot to null.
export const deleteSalary = orgMutation({
  args: { payRecordId: v.id("payRecords") },
  returns: v.null(),
  handler: async (ctx, { payRecordId }) => {
    const record = await ctx.db.get(payRecordId)
    if (record === null || record.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }

    await ctx.db.delete(payRecordId)

    const snapshot: Record<string, unknown> = {
      payYear: record.payYear,
      source: record.source,
      currency: record.currency,
    }
    await ctx.audit.log({
      type: AUDIT_EVENTS.salaryDeleted,
      payload: {
        personId: record.personId,
        changes: buildChanges(
          snapshot,
          { payYear: null, source: null, currency: null },
          [...PAY_AUDIT_FIELDS]
        ),
      },
    })

    return null
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
    components: v.array(payComponentValidator),
    effectiveAt: v.optional(v.number()),
  },
  // `created` is false when the append was skipped as a duplicate.
  returns: v.object({
    payRecordId: v.id("payRecords"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Verify person exists in the given org before inserting.
    const person = await ctx.db.get(args.personId)
    if (person === null || person.orgId !== args.orgId) {
      throw appError(ERROR_CODES.notFound)
    }

    // Idempotency: when the person's NEWEST pay record already carries the
    // same payYear and values, re-importing the same file must not append a
    // duplicate row (e.g. an abandoned import that completed server-side,
    // followed by a retry). Only the latest record is compared, so a value
    // that changed and changed back still records real history.
    const latest = await ctx.db
      .query("payRecords")
      .withIndex("by_person", (q) =>
        q.eq("orgId", args.orgId).eq("personId", args.personId)
      )
      .order("desc")
      .first()
    if (
      latest !== null &&
      latest.payYear === args.payYear &&
      latest.basicMonthly === args.basicMonthly &&
      latest.currency === args.currency &&
      latest.components.length === args.components.length &&
      latest.components.every(
        (c, i) =>
          c.kind === args.components[i]?.kind &&
          c.monthlyAmount === args.components[i]?.monthlyAmount
      )
    ) {
      return { payRecordId: latest._id, created: false }
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
      components: args.components,
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

    return { payRecordId, created: true }
  },
})

// Returns all pay records for a person ordered by effectiveAt descending
// (most recent first), each joined to the role + level active at its
// effective time. Returns an empty array when the person does not belong
// to this org.
export const getSalaryHistory = orgQuery({
  args: { personId: v.id("people") },
  returns: v.array(salaryHistoryShape),
  handler: async (ctx, { personId }) => {
    const person = await ctx.db.get(personId)
    if (person === null || person.orgId !== ctx.orgId) return []

    const rows = await ctx.db
      .query("payRecords")
      .withIndex("by_person", (q) =>
        q.eq("orgId", ctx.orgId).eq("personId", personId)
      )
      .collect()

    const assignments = await ctx.db
      .query("personAssignments")
      .withIndex("by_person", (q) =>
        q.eq("orgId", ctx.orgId).eq("personId", personId)
      )
      .collect()

    // Sort most recent effectiveAt first.
    rows.sort((a, b) => b.effectiveAt - a.effectiveAt)
    return rows.map((row) => {
      const active = assignmentActiveAt(assignments, row.effectiveAt)
      return {
        ...toPayRecordShape(row),
        assignment:
          active !== null
            ? { roleId: active.roleId, level: active.level }
            : null,
      }
    })
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
