import { fteTotalMonthlyComp } from "@workspace/constants"
import {
  ageGenderTallies,
  type ComparableGroup,
  computeGenderGap,
  equalWorkGroupRequiresDocumentation,
  type PayGapFlag,
  quartileGenderTallies,
  type WomenDominatedGroup,
  womenDominatedComparisons,
  womenDominatedGroupRequiresDocumentation,
} from "@workspace/core"
import { v } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import { orgQuery } from "../lib/functions"

// Per-gender headcounts for one distribution bucket (a pay quartile or an
// age band). Counts only, never pay values, so no small-cell masking applies.
const genderTallyShape = v.object({
  women: v.number(),
  men: v.number(),
})

// One gender-gap group in the wire shape. roleTitle/level are populated for
// equal-work groups only (null for equivalent-work). Means + gap are null
// when the group is insufficient, i.e. a gender is absent (ADR-0012
// amendment).
const gapGroupShape = v.object({
  key: v.string(),
  roleTitle: v.union(v.string(), v.null()),
  level: v.union(v.string(), v.null()),
  band: v.union(v.number(), v.null()),
  womenCount: v.number(),
  menCount: v.number(),
  womenMeanComp: v.union(v.number(), v.null()),
  menMeanComp: v.union(v.number(), v.null()),
  gapPct: v.union(v.number(), v.null()),
  flag: v.union(
    v.literal("critical"),
    v.literal("elevated"),
    v.literal("ok"),
    v.literal("insufficient")
  ),
})

// The org-level aggregate: gender-gap stats over ALL priced rows, unmasked (a
// population mean is not an individual salary, unlike a per-group mean).
const orgAggregateShape = v.object({
  womenCount: v.number(),
  menCount: v.number(),
  womenMeanComp: v.union(v.number(), v.null()),
  menMeanComp: v.union(v.number(), v.null()),
  gapPct: v.union(v.number(), v.null()),
  flag: v.union(
    v.literal("critical"),
    v.literal("elevated"),
    v.literal("ok"),
    v.literal("insufficient")
  ),
})

// One comparator in a women-dominated group's cross-level comparison
// (Diskrimineringslagen's third comparison): a non-dominated, equal-or-lower
// valued banded group whose whole-group mean out-earns the dominated group.
const womenDominatedComparisonShape = v.object({
  key: v.string(),
  roleTitle: v.union(v.string(), v.null()),
  level: v.union(v.string(), v.null()),
  band: v.number(),
  headcount: v.number(),
  womenSharePct: v.number(),
  meanComp: v.number(),
  diffPct: v.union(v.number(), v.null()),
  diffSek: v.number(),
})

// A women-dominated (>= 60% women) equal-work group plus the comparators
// that out-earn it. Unlike equal-work/equivalent-work groups, the
// whole-group mean is never masked: it is not a per-gender comparison, so
// there is no single-gender case to hide.
const womenDominatedGroupShape = v.object({
  key: v.string(),
  roleTitle: v.union(v.string(), v.null()),
  level: v.union(v.string(), v.null()),
  band: v.number(),
  headcount: v.number(),
  womenSharePct: v.number(),
  meanComp: v.number(),
  comparisons: v.array(womenDominatedComparisonShape),
})

// A mutable bucket while grouping: the per-gender comp arrays plus the display
// attributes shared by every row in the bucket.
interface Bucket {
  key: string
  roleTitle: string | null
  level: string | null
  band: number | null
  women: number[]
  men: number[]
}

type SnapshotRow = Doc<"payMappingSnapshotRows">

// Build one wire-shape GapGroup from a bucket: run the engine, then mask the
// means + gap when the flag is insufficient (a single-gender group has no
// woman-man comparison, so a "mean" would only restate individual pay).
// Counts + flag are always exposed.
function toGapGroup(bucket: Bucket) {
  const stats = computeGenderGap(bucket.women, bucket.men)
  const masked = stats.flag === "insufficient"
  return {
    key: bucket.key,
    roleTitle: bucket.roleTitle,
    level: bucket.level,
    band: bucket.band,
    womenCount: stats.womenCount,
    menCount: stats.menCount,
    womenMeanComp: masked ? null : stats.womenMeanComp,
    menMeanComp: masked ? null : stats.menMeanComp,
    gapPct: masked ? null : stats.gapPct,
    flag: stats.flag as PayGapFlag,
  }
}

// The wire shape one equal-work/equivalent-work group is rendered as.
type GapGroupWire = ReturnType<typeof toGapGroup>

function comp(row: SnapshotRow): number {
  // basicMonthly is non-null here (callers filter priced rows first).
  return fteTotalMonthlyComp(
    row.basicMonthly ?? 0,
    row.components,
    row.ftePercent
  )
}

function pushByGender(bucket: Bucket, row: SnapshotRow): void {
  if (row.gender === "Kvinna") bucket.women.push(comp(row))
  else bucket.men.push(comp(row))
}

// The whole-group mean (both genders together) of an equal-work bucket, the
// measure the women-dominated comparison ranks groups by (never the masked
// per-gender means: a group mean is not an individual salary). Every bucket
// has at least one row, so this is always a real number.
function wholeGroupMean(bucket: Bucket): number {
  const all = [...bucket.women, ...bucket.men]
  let sum = 0
  for (const value of all) sum += value
  return sum / all.length
}

// Build every grouping this run's rows support: the equal-work/
// equivalent-work gap groups and the women-dominated cross-level comparison.
// Pure over the rows (module-level, not a handler closure) so mutations
// (analyses upsert, lifecycle complete/reopen) can reuse the exact same
// groups the query shows, without duplicating the grouping logic or
// re-querying the whole table.
export function buildGapAggregates(rows: SnapshotRow[]): {
  priced: SnapshotRow[]
  currency: string | null
  equalWork: GapGroupWire[]
  equivalentWork: GapGroupWire[]
  womenDominated: WomenDominatedGroup[]
} {
  // Only rows with a frozen salary participate in the gap.
  const priced = rows.filter((r) => r.basicMonthly !== null)
  const currency =
    priced.find((r) => r.currency !== undefined)?.currency ?? null

  // Steg 1, lika arbete (equal work): (roleTitle, band, level).
  const equalWorkMap = new Map<string, Bucket>()
  for (const row of priced) {
    const key = `${row.roleTitle}|${row.band ?? "none"}|${row.level}`
    let bucket = equalWorkMap.get(key)
    if (bucket === undefined) {
      bucket = {
        key,
        roleTitle: row.roleTitle,
        level: row.level,
        band: row.band,
        women: [],
        men: [],
      }
      equalWorkMap.set(key, bucket)
    }
    pushByGender(bucket, row)
  }

  // Steg 2, likvärdigt arbete (equivalent work): band. Null-band priced rows
  // are excluded (band is the equivalence key, so they cannot be placed).
  const equivalentWorkMap = new Map<number, Bucket>()
  for (const row of priced) {
    if (row.band === null) continue
    const key = `${row.band}`
    let bucket = equivalentWorkMap.get(row.band)
    if (bucket === undefined) {
      bucket = {
        key,
        roleTitle: null,
        level: null,
        band: row.band,
        women: [],
        men: [],
      }
      equivalentWorkMap.set(row.band, bucket)
    }
    pushByGender(bucket, row)
  }

  // Deterministic order: band asc (null last), then title, then level.
  const byBandTitleLevel = (a: Bucket, b: Bucket): number => {
    const ba = a.band ?? Number.POSITIVE_INFINITY
    const bb = b.band ?? Number.POSITIVE_INFINITY
    if (ba !== bb) return ba - bb
    const ta = a.roleTitle ?? ""
    const tb = b.roleTitle ?? ""
    if (ta !== tb) return ta.localeCompare(tb)
    return (a.level ?? "").localeCompare(b.level ?? "")
  }

  const equalWork = [...equalWorkMap.values()]
    .sort(byBandTitleLevel)
    .map(toGapGroup)
  const equivalentWork = [...equivalentWorkMap.values()]
    .sort((a, b) => (a.band ?? 0) - (b.band ?? 0))
    .map(toGapGroup)

  // Diskrimineringslagen's third comparison: every women-dominated
  // equal-work group against equal-or-lower-valued banded groups that
  // out-earn it. Unbanded buckets are passed through too; the engine itself
  // drops anything without a band (it cannot be placed on the value ladder).
  const comparableGroups: ComparableGroup[] = [...equalWorkMap.values()].map(
    (bucket) => ({
      key: bucket.key,
      roleTitle: bucket.roleTitle,
      level: bucket.level,
      band: bucket.band,
      womenCount: bucket.women.length,
      menCount: bucket.men.length,
      meanComp: wholeGroupMean(bucket),
    })
  )
  const womenDominated = womenDominatedComparisons(comparableGroups)

  return {
    priced,
    currency,
    equalWork,
    equivalentWork,
    womenDominated,
  }
}

// The group keys (equalWork scope, and separately women-dominated scope)
// that exist in this run, and the subset of each that the ADR-0012 gate
// requires documentation for. Shared by the analyses mutations (Tasks 5-6):
// `*All` to validate an incoming groupKey belongs to a real group,
// `*Required` to compute completion (every required key must have a done
// documentation row).
export function requiredDocumentationKeys(rows: SnapshotRow[]): {
  equalWorkAll: Set<string>
  equalWorkRequired: Set<string>
  womenDominatedAll: Set<string>
  womenDominatedRequired: Set<string>
} {
  const { equalWork, womenDominated } = buildGapAggregates(rows)
  const equalWorkAll = new Set(equalWork.map((group) => group.key))
  const equalWorkRequired = new Set(
    equalWork
      .filter((group) => equalWorkGroupRequiresDocumentation(group.flag))
      .map((group) => group.key)
  )
  const womenDominatedAll = new Set(womenDominated.map((group) => group.key))
  const womenDominatedRequired = new Set(
    womenDominated
      .filter((group) =>
        womenDominatedGroupRequiresDocumentation(group.comparisons.length)
      )
      .map((group) => group.key)
  )
  return {
    equalWorkAll,
    equalWorkRequired,
    womenDominatedAll,
    womenDominatedRequired,
  }
}

export const getPayMappingGap = orgQuery({
  args: { runId: v.id("payMappingRuns") },
  returns: v.union(
    v.null(),
    v.object({
      currency: v.union(v.string(), v.null()),
      org: orgAggregateShape,
      equalWork: v.array(gapGroupShape),
      equivalentWork: v.array(gapGroupShape),
      // The women-dominated cross-level comparison (Diskrimineringslagen's
      // third comparison), computed over the equal-work groups.
      womenDominated: v.array(womenDominatedGroupShape),
      // Gender headcounts of the WHOLE frozen population (the survey's
      // "everyone" figure; the gap stats above cover priced rows only).
      population: genderTallyShape,
      // Four rank quartiles of the priced population, lower -> upper (A3).
      quartiles: v.array(genderTallyShape),
      // Age bands over the WHOLE frozen population (a demographics view, not
      // a pay view), aligned by index with @workspace/core's AGE_BUCKETS.
      // Rows without a parseable birth date (including erasure-pseudonymized
      // ones) are counted in `unknown`, never silently dropped.
      age: v.object({
        buckets: v.array(genderTallyShape),
        unknown: v.number(),
      }),
    })
  ),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    // Org isolation: a run id from another tenant resolves to null.
    if (run === null || run.orgId !== ctx.orgId) return null

    const rows = await ctx.db
      .query("payMappingSnapshotRows")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()

    const { priced, currency, equalWork, equivalentWork, womenDominated } =
      buildGapAggregates(rows)

    // Org-level aggregate over ALL priced rows. Unlike the equal-work/
    // equivalent-work groups, this is never masked: a population mean is not
    // an individual salary. computeGenderGap still flags "insufficient" when
    // a gender is missing, in which case gapPct is null.
    const orgWomen: number[] = []
    const orgMen: number[] = []
    for (const row of priced) {
      if (row.gender === "Kvinna") orgWomen.push(comp(row))
      else orgMen.push(comp(row))
    }
    const orgStats = computeGenderGap(orgWomen, orgMen)
    const org = {
      womenCount: orgStats.womenCount,
      menCount: orgStats.menCount,
      womenMeanComp: orgStats.womenMeanComp,
      menMeanComp: orgStats.menMeanComp,
      gapPct: orgStats.gapPct,
      flag: orgStats.flag as PayGapFlag,
    }

    // Distribution views (headcounts only). The population split and the age
    // bands cover the whole frozen population; quartiles rank the priced rows
    // (the pay-based view). Ages are taken at the run's reference date, so
    // the figures are deterministic replays of the freeze, never the clock.
    const population = rows.reduce(
      (tally, row) => {
        if (row.gender === "Kvinna") tally.women += 1
        else tally.men += 1
        return tally
      },
      { women: 0, men: 0 }
    )
    const quartiles = quartileGenderTallies(
      priced.map((row) => ({
        comp: comp(row),
        woman: row.gender === "Kvinna",
      }))
    )
    const age = ageGenderTallies(
      rows.map((row) => ({
        birthDate: row.birthDate,
        woman: row.gender === "Kvinna",
      })),
      run.referenceDate
    )

    return {
      currency,
      org,
      equalWork,
      equivalentWork,
      womenDominated,
      population,
      quartiles,
      age,
    }
  },
})
