import { fteTotalMonthlyComp } from "@workspace/constants"
import {
  classifyEqualWorkGroup,
  type ComparableGroup,
  type EqualWorkClassification,
  equalWorkGroupRequiresDocumentation,
  type MetricComparison,
  type PayGapFlag,
  quartileGenderTallies,
  type WomenDominatedGroup,
  womenDominatedComparisons,
  womenDominatedGroupRequiresDocumentation,
} from "@workspace/core"
import { v } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import { orgQuery } from "../lib/functions"
import { orgGap, tccComp } from "./orgGap"

// Per-gender headcounts for one distribution bucket (a pay quartile). Counts
// only, never pay values, so no small-cell masking applies.
const genderTallyShape = v.object({
  women: v.number(),
  men: v.number(),
})

const flagShape = v.union(
  v.literal("critical"),
  v.literal("elevated"),
  v.literal("ok"),
  v.literal("insufficient")
)

// One metric's (base salary or total comp) woman-vs-man comparison in the
// wire shape. Means are null when that gender is absent or the group is
// masked; the gap is null whenever a mean is.
const gapMetricShape = v.object({
  womenMean: v.union(v.number(), v.null()),
  menMean: v.union(v.number(), v.null()),
  gapPct: v.union(v.number(), v.null()),
  gapKr: v.union(v.number(), v.null()),
})

// One gender-gap group in the wire shape (ADR-0015): base salary is the
// primary measure, total comp rides alongside, the flag is the severest of
// the two directional (women-behind) flags, and tccDriven marks a group
// admitted on the total-comp gap alone. roleTitle/seniority are populated
// for equal-work groups only (null for equivalent-work).
const gapGroupShape = v.object({
  key: v.string(),
  roleTitle: v.union(v.string(), v.null()),
  seniority: v.union(v.string(), v.null()),
  level: v.union(v.number(), v.null()),
  womenCount: v.number(),
  menCount: v.number(),
  base: gapMetricShape,
  tcc: gapMetricShape,
  flag: flagShape,
  tccDriven: v.boolean(),
})

// A gender-pure (2+ members, one gender) equal-work group: out of the
// primary flow and the gate, listed for the opt-in deep-dive (ADR-0015).
// Identity and counts only; the deep-dive computes its statistics
// client-side from the snapshot rows it already holds.
const genderPureGroupShape = v.object({
  key: v.string(),
  roleTitle: v.union(v.string(), v.null()),
  seniority: v.union(v.string(), v.null()),
  level: v.union(v.number(), v.null()),
  gender: v.union(v.literal("Kvinna"), v.literal("Man")),
  count: v.number(),
})

// What the entry conditions kept out of the primary lika arbete flow
// (ADR-0015): singletons are silently dropped (a count survives for the
// report's methodology note), gender-pure groups feed the deep-dive, and
// reverse groups (women lead on both metrics) feed the info view.
const excludedShape = v.object({
  singletonCount: v.number(),
  genderPure: v.array(genderPureGroupShape),
  reverse: v.array(gapGroupShape),
})

// The org-level aggregate: gender-gap stats over ALL priced rows, unmasked (a
// population mean is not an individual salary, unlike a per-group mean). It
// keeps the original total-comp measure and classifyPayGap's both-directions
// flag: it is the survey's headline (EU metric surface), not an
// entry-conditioned group view.
const orgAggregateShape = v.object({
  womenCount: v.number(),
  menCount: v.number(),
  womenMeanComp: v.union(v.number(), v.null()),
  menMeanComp: v.union(v.number(), v.null()),
  gapPct: v.union(v.number(), v.null()),
  flag: flagShape,
})

// One comparator in a women-dominated group's cross-level comparison
// (Diskrimineringslagen's third comparison): a non-dominated, equal-or-lower
// valued leveled group whose whole-group mean out-earns the dominated group.
const womenDominatedComparisonShape = v.object({
  key: v.string(),
  roleTitle: v.union(v.string(), v.null()),
  seniority: v.union(v.string(), v.null()),
  level: v.number(),
  headcount: v.number(),
  womenSharePct: v.number(),
  meanComp: v.number(),
  diffPct: v.union(v.number(), v.null()),
  diffSek: v.number(),
})

// A women-dominated (>= 60% women) equal-work group plus the comparators
// that out-earn it. Unlike equal-work/equivalent-work groups, the
// whole-group mean is never masked: it is not a per-gender comparison, so
// there is no single-gender case to hide. The entry conditions never filter
// this list: an all-women group is precisely the group DL 3:9's
// cross-comparison exists for.
const womenDominatedGroupShape = v.object({
  key: v.string(),
  roleTitle: v.union(v.string(), v.null()),
  seniority: v.union(v.string(), v.null()),
  level: v.number(),
  headcount: v.number(),
  womenSharePct: v.number(),
  meanComp: v.number(),
  comparisons: v.array(womenDominatedComparisonShape),
})

// A mutable bucket while grouping: the per-gender base/tcc value pairs plus
// the display attributes shared by every row in the bucket.
interface Bucket {
  key: string
  roleTitle: string | null
  seniority: string | null
  level: number | null
  women: { base: number; tcc: number }[]
  men: { base: number; tcc: number }[]
}

type SnapshotRow = Doc<"payMappingSnapshotRows">

// The equal-work group key a snapshot row belongs to. The single source for
// the "roleTitle|level" format: the grouping below, the work layer's
// target-membership validation, and every label derivation resolve through
// this same builder so the key format can never drift.
export function equalWorkGroupKey(row: {
  roleTitle: string
  level: number | null
}): string {
  return `${row.roleTitle}|${row.level ?? "none"}`
}

// Frozen: this object is aliased into every masked group of every result.
const MASKED_METRIC: MetricComparison = Object.freeze({
  womenMean: null,
  menMean: null,
  gapPct: null,
  gapKr: null,
})

// Build one wire-shape GapGroup from a bucket's classification: single-gender
// buckets (which only reach the wire in the equivalent-work per-level list;
// the equal-work path routes them to `excluded`) mask their means + gaps (a
// one-gender "mean" would only restate that gender's pay with no woman-man
// comparison behind it). Counts + flag are always exposed.
function toGapGroup(bucket: Bucket, classification: EqualWorkClassification) {
  const masked =
    classification.outcome === "genderPure" ||
    classification.outcome === "singleton"
  return {
    key: bucket.key,
    roleTitle: bucket.roleTitle,
    seniority: bucket.seniority,
    level: bucket.level,
    womenCount: bucket.women.length,
    menCount: bucket.men.length,
    base: masked ? MASKED_METRIC : classification.base,
    tcc: masked ? MASKED_METRIC : classification.tcc,
    flag: classification.flag as PayGapFlag,
    tccDriven: classification.tccDriven,
  }
}

function classifyBucket(bucket: Bucket): EqualWorkClassification {
  return classifyEqualWorkGroup({
    womenBase: bucket.women.map((value) => value.base),
    menBase: bucket.men.map((value) => value.base),
    womenTcc: bucket.women.map((value) => value.tcc),
    menTcc: bucket.men.map((value) => value.tcc),
  })
}

// The wire shape one equal-work/equivalent-work group is rendered as.
type GapGroupWire = ReturnType<typeof toGapGroup>

const NO_COMPONENTS: { monthlyAmount: number }[] = []

// FTE-adjusted monthly base salary (grundlön), the primary group measure
// (ADR-0015). basicMonthly is non-null here (callers filter priced rows
// first).
function baseComp(row: SnapshotRow): number {
  return fteTotalMonthlyComp(
    row.basicMonthly ?? 0,
    NO_COMPONENTS,
    row.ftePercent
  )
}

function pushByGender(bucket: Bucket, row: SnapshotRow): void {
  const value = { base: baseComp(row), tcc: tccComp(row) }
  if (row.gender === "Kvinna") bucket.women.push(value)
  else bucket.men.push(value)
}

// The whole-group total-comp mean (both genders together) of an equal-work
// bucket, the measure the women-dominated comparison ranks groups by (never
// the masked per-gender means: a group mean is not an individual salary).
// Every bucket has at least one row, so this is always a real number.
function wholeGroupMean(bucket: Bucket): number {
  const all = [...bucket.women, ...bucket.men]
  let sum = 0
  for (const value of all) sum += value.tcc
  return sum / all.length
}

// Build every grouping this run's rows support: the entry-conditioned
// equal-work groups (plus what the conditions excluded), the per-level
// equivalent-work groups, and the women-dominated cross-level comparison.
// Pure over the rows (module-level, not a handler closure) so mutations
// (analyses upsert, lifecycle complete/reopen) can reuse the exact same
// groups the query shows, without duplicating the grouping logic or
// re-querying the whole table.
export function buildGapAggregates(rows: SnapshotRow[]): {
  priced: SnapshotRow[]
  currency: string | null
  // The primary lika arbete flow: groups that pass the ADR-0015 entry
  // conditions (both genders present, women trailing on base salary or, for
  // a tccDriven group, on total comp).
  equalWork: GapGroupWire[]
  excluded: {
    singletonCount: number
    genderPure: {
      key: string
      roleTitle: string | null
      seniority: string | null
      level: number | null
      gender: "Kvinna" | "Man"
      count: number
    }[]
    reverse: GapGroupWire[]
  }
  // Every priced, leveled row's per-level group, unconditionally: the
  // likvärdigt detail view applies its own entry conditions when it renders
  // (slice C); until then the women-dominated chapter's level-context
  // sentence needs every level, both directions. NOTE: `flag` on these
  // groups carries ADR-0015's DIRECTIONAL semantics (flagWomenBehind) like
  // every other group wire; no current reader consumes it (the level
  // context reads `base.gapPct` raw, in both directions), so a future
  // consumer inherits the directional flag by default, not by accident.
  equivalentWork: GapGroupWire[]
  womenDominated: WomenDominatedGroup[]
} {
  // Only rows with a frozen salary participate in the gap.
  const priced = rows.filter((r) => r.basicMonthly !== null)
  const currency =
    priced.find((r) => r.currency !== undefined)?.currency ?? null

  // Steg 1, lika arbete (equal work): (roleTitle, level). Seniority is
  // deliberately NOT part of the key; see ADR-0017. In short: 8 § is about
  // the duties, experience is a REASON a documenter gives inside a group
  // (the reason list already offers it), and splitting on it left 96 people
  // with no counterpart of the other gender at all.
  const equalWorkMap = new Map<string, Bucket>()
  for (const row of priced) {
    const key = equalWorkGroupKey(row)
    let bucket = equalWorkMap.get(key)
    if (bucket === undefined) {
      bucket = {
        key,
        roleTitle: row.roleTitle,
        // A group spans every seniority step in the title at this level
        // (ADR-0017), so it has none of its own. Taking the first row's
        // would name the whole group after whoever happened to be first.
        // The step stays visible per person in the member table, which is
        // where it helps a documenter weigh experience as a reason.
        seniority: null,
        level: row.level,
        women: [],
        men: [],
      }
      equalWorkMap.set(key, bucket)
    }
    pushByGender(bucket, row)
  }

  // Steg 2, likvärdigt arbete (equivalent work): level. Null-level priced
  // rows are excluded (level is the equivalence key, so they cannot be
  // placed).
  const equivalentWorkMap = new Map<number, Bucket>()
  for (const row of priced) {
    if (row.level === null) continue
    const key = `${row.level}`
    let bucket = equivalentWorkMap.get(row.level)
    if (bucket === undefined) {
      bucket = {
        key,
        roleTitle: null,
        seniority: null,
        level: row.level,
        women: [],
        men: [],
      }
      equivalentWorkMap.set(row.level, bucket)
    }
    pushByGender(bucket, row)
  }

  // Deterministic order: level asc (null last), then title, then seniority.
  const byLevelTitleSeniority = (a: Bucket, b: Bucket): number => {
    const la = a.level ?? Number.POSITIVE_INFINITY
    const lb = b.level ?? Number.POSITIVE_INFINITY
    if (la !== lb) return la - lb
    const ta = a.roleTitle ?? ""
    const tb = b.roleTitle ?? ""
    if (ta !== tb) return ta.localeCompare(tb)
    return (a.seniority ?? "").localeCompare(b.seniority ?? "")
  }

  // Route every equal-work bucket by its entry-condition outcome
  // (ADR-0015): shown groups form the primary flow, the rest land in
  // `excluded` (never silently vanish from the wire entirely, except
  // singletons, which reduce to a count).
  const equalWork: GapGroupWire[] = []
  const reverse: GapGroupWire[] = []
  const genderPure: {
    key: string
    roleTitle: string | null
    seniority: string | null
    level: number | null
    gender: "Kvinna" | "Man"
    count: number
  }[] = []
  let singletonCount = 0
  for (const bucket of [...equalWorkMap.values()].sort(byLevelTitleSeniority)) {
    const classification = classifyBucket(bucket)
    switch (classification.outcome) {
      case "shown":
        equalWork.push(toGapGroup(bucket, classification))
        break
      case "reverse":
        reverse.push(toGapGroup(bucket, classification))
        break
      case "genderPure":
        genderPure.push({
          key: bucket.key,
          roleTitle: bucket.roleTitle,
          seniority: bucket.seniority,
          level: bucket.level,
          gender: bucket.women.length > 0 ? "Kvinna" : "Man",
          count: bucket.women.length + bucket.men.length,
        })
        break
      case "singleton":
        singletonCount += 1
        break
    }
  }

  const equivalentWork = [...equivalentWorkMap.values()]
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
    .map((bucket) => toGapGroup(bucket, classifyBucket(bucket)))

  // Diskrimineringslagen's third comparison: every women-dominated
  // equal-work group against equal-or-lower-valued leveled groups that
  // out-earn it. ALL buckets participate, including gender-pure and
  // singleton ones (an all-women group is the very case DL 3:9 targets; the
  // entry conditions govern only the within-group lika arbete comparison).
  // Unleveled buckets are passed through too; the engine itself drops
  // anything without a level (it cannot be placed on the value ladder).
  const comparableGroups: ComparableGroup[] = [...equalWorkMap.values()].map(
    (bucket) => ({
      key: bucket.key,
      roleTitle: bucket.roleTitle,
      seniority: bucket.seniority,
      level: bucket.level,
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
    excluded: { singletonCount, genderPure, reverse },
    equivalentWork,
    womenDominated,
  }
}

// The group keys (equalWork scope, and separately women-dominated scope)
// that exist in this run, and the subset of each that the ADR-0012/0015 gate
// requires documentation for. Shared by the analyses mutations:
// `*All` to validate an incoming groupKey belongs to a real group,
// `*Required` to compute completion (every required key must have a done
// documentation row). Only SHOWN equal-work groups are valid documentation
// targets: what the entry conditions excluded carries no documentation duty
// and accepts none (ADR-0015).
// The composite key identifying ONE documented comparison: a women-dominated
// group against one higher-paid comparator. Both halves are group keys in the
// "roleTitle|level" format, so both can contain that separator; a plain join
// would let two different pairs produce the same string and the gate would
// treat one comparison as documenting another. JSON is unambiguous and needs
// no escaping rules of our own. Storage keeps the two halves in their own
// columns: this shape exists only for the gate's Set lookups.
export function comparisonDocumentationKey(
  groupKey: string,
  comparisonKey: string
): string {
  return JSON.stringify([groupKey, comparisonKey])
}

// The comparator keys belonging to ONE women-dominated group, read back out
// of the composite set above. Both writers need this list (documenting a
// single comparison checks whether any remain unexplained; the bulk fill
// walks them), and neither should re-derive the composite's shape by hand.
export function comparisonKeysForGroup(
  comparisonKeys: ReadonlySet<string>,
  groupKey: string
): string[] {
  return [...comparisonKeys]
    .map((key) => JSON.parse(key) as [string, string])
    .filter(([group]) => group === groupKey)
    .map(([, comparison]) => comparison)
}

export function requiredDocumentationKeys(rows: SnapshotRow[]): {
  equalWorkAll: Set<string>
  equalWorkRequired: Set<string>
  womenDominatedAll: Set<string>
  womenDominatedRequired: Set<string>
  womenDominatedComparisonsAll: Set<string>
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
  // Every comparator in a women-dominated group's table out-earns that group,
  // so every row is itself a difference DL 3 kap. 9 § asks to be assessed:
  // unlike the equal-work pair above there is nothing to narrow, which is why
  // this is one set rather than an all/required pair. Deliberately no
  // materiality threshold either: a floor below which a difference needs no
  // explanation would be our rule rather than the law's, and the metodbilaga
  // would have to defend it.
  const womenDominatedComparisonsAll = new Set<string>()
  for (const group of womenDominated) {
    for (const comparison of group.comparisons) {
      womenDominatedComparisonsAll.add(
        comparisonDocumentationKey(group.key, comparison.key)
      )
    }
  }
  return {
    equalWorkAll,
    equalWorkRequired,
    womenDominatedAll,
    womenDominatedRequired,
    womenDominatedComparisonsAll,
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
      // What the entry conditions kept out of the primary flow (ADR-0015).
      excluded: excludedShape,
      equivalentWork: v.array(gapGroupShape),
      // The women-dominated cross-level comparison (Diskrimineringslagen's
      // third comparison), computed over the equal-work groups.
      womenDominated: v.array(womenDominatedGroupShape),
      // Gender headcounts of the WHOLE frozen population (the survey's
      // "everyone" figure; the gap stats above cover priced rows only).
      population: genderTallyShape,
      // Four rank quartiles of the priced population, lower -> upper (A3).
      quartiles: v.array(genderTallyShape),
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

    const {
      priced,
      currency,
      equalWork,
      excluded,
      equivalentWork,
      womenDominated,
    } = buildGapAggregates(rows)

    const org = orgGap(rows)

    // Distribution views (headcounts only). The population split covers the
    // whole frozen population; quartiles rank the priced rows (the pay-based
    // view).
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
        comp: tccComp(row),
        woman: row.gender === "Kvinna",
      }))
    )
    return {
      currency,
      org,
      equalWork,
      excluded,
      equivalentWork,
      womenDominated,
      population,
      quartiles,
    }
  },
})
