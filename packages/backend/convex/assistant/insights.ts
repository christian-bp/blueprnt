import { normalizedMonthlyBase } from "@workspace/constants"
import { genderStats } from "@workspace/core"
import type { Infer } from "convex/values"
import { v } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import { internalQuery } from "../_generated/server"
import { ASSISTANT_MIN_GROUP_SIZE } from "../ai/config"
import { deriveResults } from "../assessment/compute"
import { isPriced, tccComp, type PricedRow } from "../payMapping/orgGap"
import {
  readOrgPayDefaults,
  resolveFullTimeHours,
} from "../people/fullTimeHours"
import { payRecordAt } from "../people/pay"

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
    // trend charts plot. This is a different population BASIS than
    // payStats below (that one reads the live register as of now); the tool
    // descriptions state each figure's basis to the model.
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

// "YYYY-MM", composed in code from the run's own frozen numeric
// referenceDate. Never the run's `label`: that field is user-typed free text
// and must never reach a return validator here (the numbers-only constraint
// this whole module exists to enforce, and an indirect prompt-injection
// channel otherwise: a label is attacker-controlled content).
function periodFromReferenceDate(referenceDate: number): string {
  return new Date(referenceDate).toISOString().slice(0, 7)
}

function pluralize(count: number, noun: string): string {
  return count === 1 ? `1 ${noun}` : `${count} ${noun}s`
}

function composeTrendSummary(
  metric: "headcount" | "gap",
  points: readonly TrendPoint[],
  runCount: number
): string {
  if (runCount === 0) return "No pay mappings yet."
  if (points.length === 0) {
    return `No measurable readings across ${pluralize(runCount, "pay mapping")} yet.`
  }
  const label = metric === "headcount" ? "Headcount" : "Pay gap"
  const format = (value: number) =>
    metric === "gap" ? formatPercent(value) : `${Math.round(value)}`
  // Array access is safe past the length === 0 guard above; mirrors the
  // codebase's existing sorted-array-index idiom (pay-analysis.ts).
  const first = points[0] as TrendPoint
  const last = points[points.length - 1] as TrendPoint
  const coverage = `${pluralize(points.length, "measurable reading")} across ${pluralize(runCount, "pay mapping")}`
  if (points.length === 1) {
    return `${label} (${coverage}): ${format(first.value)}.`
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
  return `${label} (${coverage}): ${format(first.value)} -> ${format(
    last.value
  )} (${direction}).`
}

export const payMappingTrend = internalQuery({
  args: {
    orgId: v.string(),
    metric: v.union(v.literal("headcount"), v.literal("gap")),
  },
  returns: v.object({
    points: v.array(v.object({ period: v.string(), value: v.number() })),
    // Total pay mappings the org has run, regardless of lifecycle status:
    // the denominator behind "N measurable readings across M pay mappings",
    // so a run whose gap could not be measured is still accounted for
    // instead of silently vanishing from the history.
    runCount: v.number(),
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
      // one; runCount still counts it, so the summary can say so honestly.
      if (value === null) continue
      points.push({
        period: periodFromReferenceDate(run.referenceDate),
        value,
      })
    }

    return {
      points,
      runCount: runs.length,
      summary: composeTrendSummary(args.metric, points, runs.length),
    }
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

// Why a group is suppressed, for summary wording only: never returned on the
// wire (the payGroupShape validator has no such field). "floor": the group's
// own count is below ASSISTANT_MIN_GROUP_SIZE. "complementary": the group's
// own count clears the floor, but it is suppressed anyway because a sibling
// gender bucket is below the floor and disclosing this one's exact mean
// would let a reader subtract it out: differencing the suppressed group's
// average from the other two's disclosed averages.
type SuppressionReason = "floor" | "complementary" | null
interface BuiltGroup {
  group: PayGroup
  reason: SuppressionReason
}

function buildPayGroup(
  key: PayGroup["key"],
  values: readonly number[]
): BuiltGroup {
  const count = values.length
  if (count < ASSISTANT_MIN_GROUP_SIZE) {
    return {
      group: {
        key,
        count,
        averagePay: null,
        medianPay: null,
        suppressed: true,
      },
      reason: "floor",
    }
  }
  const stats = genderStats(values)
  return {
    group: {
      key,
      count,
      averagePay: stats?.mean ?? null,
      medianPay: stats?.median ?? null,
      suppressed: false,
    },
    reason: null,
  }
}

// The "all" bucket, forced suppressed whenever a sibling gender bucket is.
// Its own count is still safe to report; only the statistics are withheld,
// since count is exactly what a reader would need alongside the other
// bucket's disclosed mean to reconstruct the withheld figure by subtraction.
function suppressedAllGroup(count: number): BuiltGroup {
  return {
    group: {
      key: "all",
      count,
      averagePay: null,
      medianPay: null,
      suppressed: true,
    },
    reason: "complementary",
  }
}

function labelForGroup(key: PayGroup["key"]): string {
  return key === "all" ? "overall" : key
}

function formatGroupSummary(built: BuiltGroup, unit: string): string {
  const { group, reason } = built
  const label = labelForGroup(group.key)
  if (reason === "complementary") {
    return "the overall figure is withheld because a group within it is too small to report"
  }
  if (group.suppressed) {
    if (group.count === 0) {
      return group.key === "all"
        ? "no pay data in the register"
        : `no ${label} in the register`
    }
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
  built: readonly BuiltGroup[],
  currency: string | null
): string {
  const unit = currency ?? ""
  const genderBuilt = built.filter((b) => b.group.key !== "all")
  const allBuilt = built.find((b) => b.group.key === "all")
  const parts: BuiltGroup[] =
    genderBuilt.length > 0
      ? [
          ...genderBuilt,
          // The withheld-overall line only earns its place in the summary
          // when it is withheld FOR that reason; an ordinary disclosed "all"
          // figure would be redundant next to the per-gender breakdown.
          ...(allBuilt !== undefined && allBuilt.reason === "complementary"
            ? [allBuilt]
            : []),
        ]
      : allBuilt !== undefined
        ? [allBuilt]
        : []
  const body = parts.map((b) => formatGroupSummary(b, unit)).join(", ")
  // payStats and orgStats read different population bases (this one is the
  // live register as of `asOf`, orgStats is the newest run's frozen
  // population); the fixed phrase keeps that basis explicit in the
  // model-facing text rather than implied.
  return `Average monthly pay in the current register: ${body}.`
}

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/

// A payRecord's currency is CSV-imported, unconstrained free text. Gate it
// through a strict ISO-4217-shaped allowlist before it ever reaches a return
// value or a summary string; anything else is withheld as null rather than
// interpolated, closing the indirect prompt-injection channel a malformed
// import column could otherwise open.
function validCurrencyCode(value: string | null): string | null {
  return value !== null && CURRENCY_CODE_PATTERN.test(value) ? value : null
}

export const payStats = internalQuery({
  args: {
    orgId: v.string(),
    groupBy: v.optional(v.literal("gender")),
    // The caller passes Date.now() (mirrors people/pay.ts getCurrentSalary):
    // this query has no frozen reference date of its own to inherit, and the
    // wall-clock read belongs to the action that calls it once per assistant
    // turn, not to this query.
    asOf: v.number(),
  },
  returns: v.object({
    groups: v.array(payGroupShape),
    currency: v.union(v.string(), v.null()),
    summary: v.string(),
  }),
  handler: async (ctx, args) => {
    // 1. Derive (pay, gender) per active person exactly as the pay-mapping
    //    analysis does: the current pay record's FTE-adjusted total monthly
    //    comp (tccComp/isPriced, the same helpers orgGap() uses over frozen
    //    rows) selected by payRecordAt (the same rule payMapping/runs.ts's
    //    freeze and people/pay.ts's getCurrentSalary use), paired with the
    //    person's gender. Individual values exist ONLY inside this handler;
    //    nothing below this point returns one.
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect()
    const active = people.filter((person) => person.archivedAt === undefined)

    // One org-scoped indexed read of payRecords (by_org) instead of one
    // query per person: an org-scaled read stays a single bounded index scan
    // rather than an N+1 fan-out.
    const allPayRows = await ctx.db
      .query("payRecords")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect()
    const rowsByPerson = new Map<string, Doc<"payRecords">[]>()
    for (const row of allPayRows) {
      const key = row.personId as string
      const existing = rowsByPerson.get(key)
      if (existing === undefined) rowsByPerson.set(key, [row])
      else existing.push(row)
    }

    // Org pay defaults, read once outside this per-person loop: the
    // currency/country/full-time-hours fallback every person's hours
    // resolution needs.
    const orgDefaults = await readOrgPayDefaults(ctx, args.orgId)

    let currency: string | null = null
    const priced: { gender: "Man" | "Kvinna"; monthly: number }[] = []
    for (const person of active) {
      const rows = rowsByPerson.get(person._id as string) ?? []
      const record = payRecordAt(rows, args.asOf)
      if (record === null) continue
      const hours = resolveFullTimeHours(person, orgDefaults)
      const row: PricedRow = {
        gender: person.gender,
        basicMonthly: normalizedMonthlyBase(
          record.basicAmount,
          record.basis,
          hours.hoursPerMonth
        ),
        components: record.components,
        ftePercent: person.ftePercent,
        basis: record.basis,
      }
      if (!isPriced(row)) continue
      priced.push({ gender: person.gender, monthly: tccComp(row) })
      currency = currency ?? record.currency
    }

    // 2. Bucket: "all", plus "women"/"men" when groupBy === "gender" (the
    //    stored gender literals are "Kvinna"/"Man"; mapped to the fixed
    //    keys here, never returned as-is).
    const womenBuilt =
      args.groupBy === "gender"
        ? buildPayGroup(
            "women",
            priced.filter((p) => p.gender === "Kvinna").map((p) => p.monthly)
          )
        : null
    const menBuilt =
      args.groupBy === "gender"
        ? buildPayGroup(
            "men",
            priced.filter((p) => p.gender === "Man").map((p) => p.monthly)
          )
        : null

    // 3. Disclosure floor (ADR-0018): the "all" bucket's exact mean, read
    //    together with the OTHER gender's disclosed exact mean, lets a
    //    reader difference out a suppressed gender bucket's exact average by
    //    subtraction. Whenever either gender bucket is suppressed, the "all"
    //    bucket is suppressed too; its count alone carries no such risk.
    const anyGenderSuppressed =
      (womenBuilt?.group.suppressed ?? false) ||
      (menBuilt?.group.suppressed ?? false)
    const allValues = priced.map((p) => p.monthly)
    const allBuilt = anyGenderSuppressed
      ? suppressedAllGroup(allValues.length)
      : buildPayGroup("all", allValues)

    const built = [allBuilt, womenBuilt, menBuilt].filter(
      (candidate): candidate is BuiltGroup => candidate !== null
    )
    const validCurrency = validCurrencyCode(currency)

    return {
      groups: built.map((b) => b.group),
      currency: validCurrency,
      summary: composePayStatsSummary(built, validCurrency),
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
