import { genderStats } from "@workspace/core"
import type { Infer } from "convex/values"
import { v } from "convex/values"
import { internalQuery } from "../_generated/server"
import type { Doc } from "../_generated/dataModel"
import { ASSISTANT_MIN_GROUP_SIZE } from "../ai/config"
import { deriveResults } from "../assessment/compute"
import { isPriced, tccComp, type PricedRow } from "../payMapping/orgGap"

// The assistant's entire data surface. Returns are aggregates ONLY: numbers,
// fixed literals, and a summary string composed here from those numbers.
// These validators are the no-PII guarantee the ADR-0018 tools rely on:
// nothing here reads people/payRecords/personAssignments outside payStats and
// containsEmployeeName, and adding a stored-text field to a return object is
// a reviewable schema change (pii-guard.test.ts enforces the confinement).

function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`
}

// The newest run by frozen reference date (the same "latest mapping" every
// overview widget reads), or null when the org has never started one.
function newestRun(
  runs: readonly Doc<"payMappingRuns">[]
): Doc<"payMappingRuns"> | null {
  let newest: Doc<"payMappingRuns"> | null = null
  for (const run of runs) {
    if (newest === null || run.referenceDate > newest.referenceDate) {
      newest = run
    }
  }
  return newest
}

function composeOrgStatsSummary(args: {
  workforceCount: number
  rolesTotal: number
  rolesEvaluated: number
  currentGapPercent: number | null
  hasRun: boolean
}): string {
  const parts = [
    `Workforce: ${args.workforceCount} people.`,
    `Roles evaluated: ${args.rolesEvaluated} of ${args.rolesTotal}.`,
  ]
  if (!args.hasRun) {
    parts.push("No pay mappings yet.")
  } else if (args.currentGapPercent === null) {
    parts.push("The latest pay mapping's gap is not measurable yet.")
  } else {
    parts.push(`Latest pay gap: ${formatPercent(args.currentGapPercent)}.`)
  }
  return parts.join(" ")
}

export const orgStats = internalQuery({
  args: { orgId: v.string() },
  returns: v.object({
    workforceCount: v.number(),
    rolesTotal: v.number(),
    rolesEvaluated: v.number(),
    currentGapPercent: v.union(v.number(), v.null()),
    summary: v.string(),
  }),
  handler: async (ctx, args) => {
    // Roles: the same org-scoped "active roles" set listRoles/lib/todo.ts
    // read, independent of whether a model exists yet (deriveResults alone
    // would silently read 0 roles for an org with roles but no model).
    const roleRows = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect()
    const activeRoles = roleRows.filter((role) => role.archivedAt === undefined)

    // ratedCount/totalCriteria per role, exactly as listRoles derives them
    // (ADR-0002: score/level/ratedCount are always derived, never stored).
    const derived = await deriveResults(ctx, args.orgId)
    const resultByRole = new Map(
      derived.results.map((result) => [result.roleId, result])
    )
    // Mirrors lib/todo.ts's isRoleEvaluated: totalCriteria > 0 (a model with
    // criteria exists) AND every criterion on the role is rated.
    const rolesEvaluated = activeRoles.filter((role) => {
      const ratedCount = resultByRole.get(role._id as string)?.ratedCount ?? 0
      return derived.totalCriteria > 0 && ratedCount === derived.totalCriteria
    }).length

    const runs = await ctx.db
      .query("payMappingRuns")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect()
    const latest = newestRun(runs)

    // The frozen headcount/gap off the latest run row, never counted from
    // live people rows: those two figures are ENGINE OUTPUT frozen at freeze
    // time (payMapping/tables.ts), the same fields the headcount/pay-gap
    // trend charts plot.
    const workforceCount = latest?.populationCount ?? 0
    const currentGapPercent = latest?.orgGapPct ?? null

    return {
      workforceCount,
      rolesTotal: activeRoles.length,
      rolesEvaluated,
      currentGapPercent,
      summary: composeOrgStatsSummary({
        workforceCount,
        rolesTotal: activeRoles.length,
        rolesEvaluated,
        currentGapPercent,
        hasRun: latest !== null,
      }),
    }
  },
})

type TrendPoint = { period: string; value: number }

function composeTrendSummary(
  metric: "headcount" | "gap",
  points: readonly TrendPoint[]
): string {
  if (points.length === 0) return "No pay mappings yet."
  const label = metric === "headcount" ? "Headcount" : "Pay gap"
  const format = (value: number) =>
    metric === "gap" ? formatPercent(value) : `${Math.round(value)}`
  // Array access is safe past the length === 0 guard above; mirrors the
  // codebase's existing sorted-array-index idiom (pay-analysis.ts).
  const first = points[0] as TrendPoint
  const last = points[points.length - 1] as TrendPoint
  if (points.length === 1) {
    return `${label} over 1 pay mapping: ${format(first.value)}.`
  }
  const direction =
    last.value === first.value
      ? "unchanged"
      : metric === "gap"
        ? last.value < first.value
          ? "improving"
          : "worsening"
        : last.value > first.value
          ? "growing"
          : "shrinking"
  return `${label} over ${points.length} pay mappings: ${format(
    first.value
  )} -> ${format(last.value)} (${direction}).`
}

export const payMappingTrend = internalQuery({
  args: {
    orgId: v.string(),
    metric: v.union(v.literal("headcount"), v.literal("gap")),
  },
  returns: v.object({
    points: v.array(v.object({ period: v.string(), value: v.number() })),
    summary: v.string(),
  }),
  handler: async (ctx, args) => {
    // One point per payMappingRuns row (org-scoped index, bounded: one row
    // per run), oldest first (the same order lib/headcount-trend.ts and
    // lib/pay-gap-trend.ts plot in).
    const runs = await ctx.db
      .query("payMappingRuns")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect()
    const sorted = [...runs].sort((a, b) => a.referenceDate - b.referenceDate)

    const points: TrendPoint[] = []
    for (const run of sorted) {
      const value =
        args.metric === "headcount" ? run.populationCount : run.orgGapPct
      // A run's gap can be null (a gender absent among its priced rows). The
      // return validator is v.number() only (no chart break to draw here),
      // so an unmeasurable run contributes no point rather than a fabricated
      // one.
      if (value === null) continue
      points.push({ period: run.label, value })
    }

    return { points, summary: composeTrendSummary(args.metric, points) }
  },
})

const payGroupShape = v.object({
  key: v.union(v.literal("all"), v.literal("women"), v.literal("men")),
  count: v.number(),
  // Null when suppressed OR when the group has no pay data.
  averagePay: v.union(v.number(), v.null()),
  medianPay: v.union(v.number(), v.null()),
  suppressed: v.boolean(),
})
type PayGroup = Infer<typeof payGroupShape>

function buildPayGroup(
  key: PayGroup["key"],
  values: readonly number[]
): PayGroup {
  const count = values.length
  if (count < ASSISTANT_MIN_GROUP_SIZE) {
    return { key, count, averagePay: null, medianPay: null, suppressed: true }
  }
  const stats = genderStats(values)
  return {
    key,
    count,
    averagePay: stats?.mean ?? null,
    medianPay: stats?.median ?? null,
    suppressed: false,
  }
}

function labelForGroup(key: PayGroup["key"]): string {
  return key === "all" ? "Overall" : key
}

function formatGroupSummary(group: PayGroup, unit: string): string {
  const label = labelForGroup(group.key)
  if (group.suppressed) {
    return `the ${label} group is too small to report (${group.count} people)`
  }
  if (group.averagePay === null) {
    return `${label} has no pay data on record`
  }
  const unitSuffix = unit === "" ? "" : ` ${unit}`
  const average = Math.round(group.averagePay)
  const medianPart =
    group.medianPay === null
      ? ""
      : `, median ${Math.round(group.medianPay)}${unitSuffix}`
  return `${label} ${average}${unitSuffix} (n=${group.count}${medianPart})`
}

function composePayStatsSummary(
  groups: readonly PayGroup[],
  currency: string | null
): string {
  const unit = currency ?? ""
  const genderGroups = groups.filter((group) => group.key !== "all")
  const reported = genderGroups.length > 0 ? genderGroups : groups
  return `Average monthly pay: ${reported
    .map((group) => formatGroupSummary(group, unit))
    .join(", ")}.`
}

// The pay-mapping freeze's current-pay-record selection (payMapping/runs.ts'
// non-exported payRecordAt, mirrored here faithfully: greatest effectiveAt
// <= asOf; see also people/pay.ts getCurrentSalary's identical inline loop).
// asOf is "now": this query has no frozen reference date to inherit, and it
// runs once per assistant tool call rather than staying open on a reactive
// screen, so the wall-clock read here does not risk the stale-subscription
// problem the no-Date.now()-in-queries guideline targets.
function currentPayRecord(
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

export const payStats = internalQuery({
  args: { orgId: v.string(), groupBy: v.optional(v.literal("gender")) },
  returns: v.object({
    groups: v.array(payGroupShape),
    currency: v.union(v.string(), v.null()),
    summary: v.string(),
  }),
  handler: async (ctx, args) => {
    // 1. Derive (pay, gender) per active person exactly as the pay-mapping
    //    analysis does: the current pay record's FTE-adjusted total monthly
    //    comp (tccComp/isPriced, the same helpers orgGap() uses over frozen
    //    rows), paired with the person's gender. Individual values exist
    //    ONLY inside this handler; nothing below this point returns one.
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect()
    const active = people.filter((person) => person.archivedAt === undefined)

    const asOf = Date.now()
    let currency: string | null = null
    const priced: { gender: "Man" | "Kvinna"; monthly: number }[] = []
    for (const person of active) {
      const payRows = await ctx.db
        .query("payRecords")
        .withIndex("by_person", (q) =>
          q.eq("orgId", args.orgId).eq("personId", person._id)
        )
        .collect()
      const record = currentPayRecord(payRows, asOf)
      if (record === null) continue
      const row: PricedRow = {
        gender: person.gender,
        basicMonthly: record.basicMonthly,
        components: record.components,
        ftePercent: person.ftePercent,
      }
      if (!isPriced(row)) continue
      priced.push({ gender: person.gender, monthly: tccComp(row) })
      currency = currency ?? record.currency
    }

    // 2. Bucket: "all", plus "women"/"men" when groupBy === "gender" (the
    //    stored gender literals are "Kvinna"/"Man"; mapped to the fixed
    //    keys here, never returned as-is).
    const groups: PayGroup[] = [
      buildPayGroup(
        "all",
        priced.map((p) => p.monthly)
      ),
    ]
    if (args.groupBy === "gender") {
      groups.push(
        buildPayGroup(
          "women",
          priced.filter((p) => p.gender === "Kvinna").map((p) => p.monthly)
        )
      )
      groups.push(
        buildPayGroup(
          "men",
          priced.filter((p) => p.gender === "Man").map((p) => p.monthly)
        )
      )
    }

    // 3. Each bucket below ASSISTANT_MIN_GROUP_SIZE is suppressed by
    //    buildPayGroup before it ever reaches this return.
    return {
      groups,
      currency,
      summary: composePayStatsSummary(groups, currency),
    }
  },
})

// Input-side PII screen (ADR-0018): a message carrying an employee's FULL
// display name never becomes a prompt. Full-name matching keeps false
// positives low (a lone first name is legitimate general language); the read
// is org-scoped and runs once per generation, not per keystroke.
export const containsEmployeeName = internalQuery({
  args: { orgId: v.string(), text: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const haystack = args.text.toLowerCase()
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect()
    return people.some((person) => {
      const name = person.displayName.trim().toLowerCase()
      return name.includes(" ") && haystack.includes(name)
    })
  },
})
