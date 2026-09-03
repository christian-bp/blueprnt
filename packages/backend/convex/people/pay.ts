import { v } from "convex/values"
import type { BasePayBasis } from "@workspace/constants"
import {
  fteTotalMonthlyComp,
  normalizedMonthlyBase,
  totalMonthlyComp,
} from "@workspace/constants"
import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { internalMutation } from "../_generated/server"
import {
  AUDIT_EVENTS,
  buildChanges,
  buildCreateChanges,
  logAudit,
  PAY_AUDIT_FIELDS,
} from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"
import { assignmentActiveAt, loadRoleAssignments } from "./assignments"
import {
  type OrgPayDefaults,
  readOrgPayDefaults,
  resolveFullTimeHours,
} from "./fullTimeHours"
import { sameSalaryValues } from "./importDiff"
import { basePayBasis } from "./tables"

// The pay record active at `asOf`: the row with the greatest effectiveAt
// that is <= asOf. The single source of this selection rule: getCurrentSalary
// below, payMapping/runs.ts's freeze (a person's snapshot salary), and
// assistant/insights.ts's payStats all resolve "current pay" through this one
// function, so a change to the rule can never drift between the three.
export function payRecordAt(
  rows: readonly Doc<"payRecords">[],
  asOf: number
): Doc<"payRecords"> | null {
  let current: Doc<"payRecords"> | null = null
  for (const row of rows) {
    if (
      row.effectiveAt <= asOf &&
      (current === null || row.effectiveAt > current.effectiveAt)
    ) {
      current = row
    }
  }
  return current
}

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

// The org's configured currency. Money is always stored in the organization's
// own currency, so writers validate the incoming currency against this and
// reject a mismatch. Throws when the org has no currency set yet (a pay record
// cannot be recorded without knowing its currency).
async function requireOrgCurrency(
  ctx: QueryCtx & { orgId: string }
): Promise<string> {
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
    .first()
  if (org?.currency === undefined || org.currency === "") {
    throw appError(ERROR_CODES.invalidInput)
  }
  return org.currency
}

// Validator for a single compensation component. Exported for the import
// chunk mutation's row validator (importHelpers.importChunk).
export const payComponentValidator = v.object({
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
  // The figure as recorded and its basis.
  basis: basePayBasis,
  basicAmount: v.number(),
  // Derived: the full-time-equivalent monthly base (normalizedMonthlyBase
  // with the person's resolved full-time hours). Computed on read, never
  // stored, so a corrected hours default reaches every record at once.
  basicMonthly: v.number(),
  hoursPerMonth: v.number(),
  currency: v.string(),
  components: v.array(payComponentValidator),
  // Derived: basicMonthly + sum(components[*].monthlyAmount).
  totalMonthlyComp: v.number(),
  effectiveAt: v.number(),
  createdAt: v.number(),
}

const payRecordShape = v.object(payRecordFields)

// History rows additionally carry the role + seniority the salary was earned
// under: the assignment active at the record's effectiveAt, joined on read
// via assignmentActiveAt (derived, never stored; ADR-0002 spirit). Null when
// the person had no assignment yet at that time (e.g. salary imported before
// the first classification).
const salaryHistoryShape = v.object({
  ...payRecordFields,
  assignment: v.union(
    v.object({ roleId: v.id("roles"), seniority: v.string() }),
    v.null()
  ),
})

function toPayRecordShape(
  doc: Doc<"payRecords">,
  hours: { hoursPerMonth: number }
) {
  const basicMonthly = normalizedMonthlyBase(
    doc.basicAmount,
    doc.basis,
    hours.hoursPerMonth
  )
  return {
    payRecordId: doc._id,
    personId: doc.personId,
    payYear: doc.payYear,
    source: doc.source,
    basis: doc.basis,
    basicAmount: doc.basicAmount,
    basicMonthly,
    hoursPerMonth: hours.hoursPerMonth,
    currency: doc.currency,
    components: doc.components,
    totalMonthlyComp: totalMonthlyComp(basicMonthly, doc.components),
    effectiveAt: doc.effectiveAt,
    createdAt: doc.createdAt,
  }
}

// Append a pay record row for a person (manual entry by HR). Each call always
// inserts a new row: a raise is a new record, never an overwrite. The existing
// history is preserved and returned by getSalaryHistory.
//
// Audit: pay.salarySet with an AMOUNT-FREE payload (GDPR). Only payYear,
// source, currency, and basis (coded, not an amount) are captured in the
// changes diff.
export const setSalary = orgMutation({
  args: {
    personId: v.id("people"),
    payYear: v.number(),
    basis: basePayBasis,
    basicAmount: v.number(),
    currency: v.string(),
    components: v.array(payComponentValidator),
    effectiveAt: v.optional(v.number()),
  },
  returns: v.id("payRecords"),
  handler: async (ctx, args) => {
    // Assert the person belongs to the caller's org.
    await requireOwnPerson(ctx, args.personId)

    // Money is always in the org's own currency (never a per-record choice),
    // and amounts are non-negative. Reject anything else rather than store it.
    const orgCurrency = await requireOrgCurrency(ctx)
    if (
      args.currency !== orgCurrency ||
      args.basicAmount < 0 ||
      args.components.some((component) => component.monthlyAmount < 0)
    ) {
      throw appError(ERROR_CODES.invalidInput)
    }

    const effectiveAt = args.effectiveAt ?? Date.now()
    const createdAt = Date.now()

    const payRecordId = await ctx.db.insert("payRecords", {
      orgId: ctx.orgId,
      personId: args.personId,
      payYear: args.payYear,
      source: "manual",
      basis: args.basis,
      basicAmount: args.basicAmount,
      currency: args.currency,
      components: args.components,
      effectiveAt,
      createdAt,
    })

    // GDPR: the audit payload contains ONLY non-sensitive fields. Salary
    // amounts (basicAmount, components) are never stored in the audit trail.
    const snapshot: Record<string, unknown> = {
      payYear: args.payYear,
      source: "manual",
      currency: args.currency,
      basis: args.basis,
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
      basis: record.basis,
    }
    await ctx.audit.log({
      type: AUDIT_EVENTS.salaryDeleted,
      payload: {
        personId: record.personId,
        changes: buildChanges(
          snapshot,
          { payYear: null, source: null, currency: null, basis: null },
          [...PAY_AUDIT_FIELDS]
        ),
      },
    })

    return null
  },
})

// Core of the payroll-import salary append, shared by the single-row
// internal mutation below and the import chunk mutation
// (importHelpers.importChunk), which runs it for a whole chunk of rows
// inside ONE transaction. Takes the bare MutationCtx: the caller owns the
// auth/org gate. Inserts a pay record row with source "import"; amount-free
// audit payload (same GDPR rule as setSalary).
export async function appendSalaryCore(
  ctx: MutationCtx,
  args: {
    orgId: string
    actorId: string
    personId: Id<"people">
    payYear: number
    basis: BasePayBasis
    basicAmount: number
    currency: string
    components: { kind: string; monthlyAmount: number }[]
    effectiveAt?: number
  }
): Promise<{ payRecordId: Id<"payRecords">; created: boolean }> {
  // Verify person exists in the given org before inserting.
  const person = await ctx.db.get(args.personId)
  if (person === null || person.orgId !== args.orgId) {
    throw appError(ERROR_CODES.notFound)
  }

  // Amounts are non-negative (the import validator already blocks negatives
  // upstream; this is the write-path backstop so a payRecord's derived
  // basic/variable split can never go negative).
  if (
    args.basicAmount < 0 ||
    args.components.some((component) => component.monthlyAmount < 0)
  ) {
    throw appError(ERROR_CODES.invalidInput)
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
  // Shared with previewImport so the review preview applies exactly this rule.
  if (latest !== null && sameSalaryValues(args, latest)) {
    return { payRecordId: latest._id, created: false }
  }

  const effectiveAt = args.effectiveAt ?? Date.now()
  const createdAt = Date.now()

  const payRecordId = await ctx.db.insert("payRecords", {
    orgId: args.orgId,
    personId: args.personId,
    payYear: args.payYear,
    source: "import",
    basis: args.basis,
    basicAmount: args.basicAmount,
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
    basis: args.basis,
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
}

// Internal mutation for the payroll-import path (single row; the chunked
// path calls appendSalaryCore directly). Uses the free-function logAudit
// (internal mutations have no ctx.audit).
export const appendSalary = internalMutation({
  args: {
    orgId: v.string(),
    actorId: v.string(),
    personId: v.id("people"),
    payYear: v.number(),
    basis: basePayBasis,
    basicAmount: v.number(),
    currency: v.string(),
    components: v.array(payComponentValidator),
    effectiveAt: v.optional(v.number()),
  },
  // `created` is false when the append was skipped as a duplicate.
  returns: v.object({
    payRecordId: v.id("payRecords"),
    created: v.boolean(),
  }),
  handler: (ctx, args) => appendSalaryCore(ctx, args),
})

// Returns all pay records for a person ordered by effectiveAt descending
// (most recent first), each joined to the role + seniority active at its
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

    const org = await readOrgPayDefaults(ctx, ctx.orgId)
    const hours = resolveFullTimeHours(person, org)

    // Sort most recent effectiveAt first.
    rows.sort((a, b) => b.effectiveAt - a.effectiveAt)
    return rows.map((row) => {
      const active = assignmentActiveAt(assignments, row.effectiveAt)
      return {
        ...toPayRecordShape(row, hours),
        assignment:
          active !== null
            ? { roleId: active.roleId, seniority: active.seniority }
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

    const current = payRecordAt(rows, asOf)
    if (current === null) return null

    const org = await readOrgPayDefaults(ctx, ctx.orgId)
    const hours = resolveFullTimeHours(person, org)
    return toPayRecordShape(current, hours)
  },
})

// What the salary dialog needs before a figure is typed: the currency the
// amount is in and the full-time hours the derived monthly line multiplies
// an hourly rate by.
export const getPayDefaults = orgQuery({
  args: { personId: v.id("people") },
  returns: v.object({
    currency: v.string(),
    hoursPerMonth: v.number(),
  }),
  handler: async (ctx, { personId }) => {
    const person = await requireOwnPerson(ctx, personId)
    const org = await readOrgPayDefaults(ctx, ctx.orgId)
    const hours = resolveFullTimeHours(person, org)
    return {
      currency: org.currency,
      hoursPerMonth: hours.hoursPerMonth,
    }
  },
})

// The person page's pay-comparison payload. Each point names a colleague
// (displayName, so the chart tooltip can label people, as the People register
// does), carries the FTE-adjusted basic/variable split and pay year for the
// tooltip, and the gender the chart colors dots by (the tool's core lens is the
// pay gap between men and women; HR already sees gender in the People
// register). This is an HR-only, org-scoped read; it never enters the audit
// trail (where employee-identifying fields and salary are forbidden).
const payComparisonShape = v.union(
  v.object({ status: v.literal("unclassified") }),
  v.object({ status: v.literal("noSalary") }),
  v.object({
    status: v.literal("ready"),
    currency: v.string(),
    excludedCount: v.number(),
    points: v.array(
      v.object({
        publicId: v.string(),
        displayName: v.string(),
        gender: v.union(v.literal("Man"), v.literal("Kvinna")),
        seniority: v.string(),
        basic: v.number(),
        variable: v.number(),
        amount: v.number(),
        payYear: v.number(),
        isSelf: v.boolean(),
      })
    ),
  })
)

// One person's dot for the pay-comparison chart. All amounts are FTE-adjusted
// (the chart's like-for-like basis, decision #3): basic and variable are each
// grossed to full-time via the shared fteTotalMonthlyComp helper (an hourly
// record's figure is already a full-time one, so fteTotalMonthlyComp skips
// the division for it), and variable is the remainder so the two always sum
// to the plotted total. The name travels with the point so the tooltip can
// label the person.
function comparisonPoint(
  person: Doc<"people">,
  record: Doc<"payRecords">,
  seniority: string,
  isSelf: boolean,
  org: OrgPayDefaults
) {
  const { hoursPerMonth } = resolveFullTimeHours(person, org)
  const basicMonthly = normalizedMonthlyBase(
    record.basicAmount,
    record.basis,
    hoursPerMonth
  )
  const amount = Math.round(
    fteTotalMonthlyComp(
      basicMonthly,
      record.components,
      person.ftePercent,
      record.basis
    )
  )
  const basic = Math.round(
    fteTotalMonthlyComp(basicMonthly, [], person.ftePercent, record.basis)
  )
  return {
    publicId: person.publicId,
    displayName: person.displayName,
    gender: person.gender,
    seniority,
    basic,
    variable: amount - basic,
    amount,
    payYear: record.payYear,
    isSelf,
  }
}

// A person's most recent pay record: greatest payYear, ties broken by
// effectiveAt (a correction within the same year wins over the original).
async function latestPayRecord(
  ctx: QueryCtx & { orgId: string },
  personId: Id<"people">
): Promise<Doc<"payRecords"> | null> {
  const rows = await ctx.db
    .query("payRecords")
    .withIndex("by_person", (q) =>
      q.eq("orgId", ctx.orgId).eq("personId", personId)
    )
    .collect()
  let latest: Doc<"payRecords"> | null = null
  for (const row of rows) {
    if (
      latest === null ||
      row.payYear > latest.payYear ||
      (row.payYear === latest.payYear && row.effectiveAt > latest.effectiveAt)
    ) {
      latest = row
    }
  }
  return latest
}

// Comparison data for the person page's "Pay compared with the role" chart:
// everyone with an active assignment on the same role, on FTE-adjusted total
// monthly pay (fteTotalMonthlyComp, the V2 salary spec's canonical metric),
// each person contributing their latest payYear record. Peers paid in another
// currency than the viewed person are excluded and counted (not comparable);
// archived peers are excluded; the viewed person is included archived or not.
// Derived on read, nothing stored. Read-only, so no audit row.
export const getRolePayComparison = orgQuery({
  args: { personId: v.id("people") },
  returns: payComparisonShape,
  handler: async (ctx, { personId }) => {
    const person = await ctx.db.get(personId)
    if (person === null || person.orgId !== ctx.orgId) {
      // Same silent empty as getSalaryHistory for a foreign person: reveal
      // nothing about other orgs' data.
      return { status: "unclassified" as const }
    }

    const ownAssignments = await ctx.db
      .query("personAssignments")
      .withIndex("by_person", (q) =>
        q.eq("orgId", ctx.orgId).eq("personId", personId)
      )
      .collect()
    const active = ownAssignments.find((a) => a.endedAt === undefined)
    if (active === undefined) return { status: "unclassified" as const }

    const ownRecord = await latestPayRecord(ctx, personId)
    if (ownRecord === null) return { status: "noSalary" as const }

    const roleAssignments = await loadRoleAssignments(
      ctx,
      ctx.orgId,
      active.roleId
    )

    const activePeers = roleAssignments.filter(
      (a) => a.endedAt === undefined && a.personId !== personId
    )
    // Resolve every peer's person doc and latest pay record concurrently
    // rather than serializing one peer's two reads after the next.
    const peerData = await Promise.all(
      activePeers.map(async (assignment) => ({
        assignment,
        peer: await ctx.db.get(assignment.personId),
        record: await latestPayRecord(ctx, assignment.personId),
      }))
    )

    const org = await readOrgPayDefaults(ctx, ctx.orgId)

    const points: Array<ReturnType<typeof comparisonPoint>> = [
      comparisonPoint(person, ownRecord, active.seniority, true, org),
    ]
    let excludedCount = 0
    for (const { assignment, peer, record } of peerData) {
      if (peer === null || peer.archivedAt !== undefined) continue
      if (record === null) continue
      if (record.currency !== ownRecord.currency) {
        excludedCount += 1
        continue
      }
      points.push(
        comparisonPoint(peer, record, assignment.seniority, false, org)
      )
    }

    return {
      status: "ready" as const,
      currency: ownRecord.currency,
      excludedCount,
      points,
    }
  },
})
