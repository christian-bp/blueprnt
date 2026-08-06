// Iteration 2 analysis engine (ADR-0015): entry conditions for the lika
// arbete view, per-metric (base salary vs total comp) group comparisons,
// full per-gender descriptive statistics, and the individual-level
// cross-level (tvärnivå) check for likvärdigt arbete. Pure and
// side-effect-free (ADR-0002): the same math runs in the Convex gate and in
// the client's detail views. Callers pass FTE-adjusted monthly values; the
// FTE formula itself lives in @workspace/constants (fteTotalMonthlyComp) and
// is never re-derived here.

import { classifyPayGap, type PayGapFlag } from "./pay-gap"

// Full descriptive statistics for one gender's values in a group (the
// deep-dive and detail views' min/median/mean/max/spread row). stdDev is the
// population standard deviation (the group IS the whole population under
// analysis, not a sample). Null for an empty list: a group without that
// gender has no statistics, not zeroes.
export interface GenderStats {
  count: number
  min: number
  max: number
  mean: number
  median: number
  stdDev: number
}

export function genderStats(values: readonly number[]): GenderStats | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const count = sorted.length
  let sum = 0
  for (const value of sorted) sum += value
  const mean = sum / count
  const mid = Math.floor(count / 2)
  const median =
    count % 2 === 1
      ? (sorted[mid] as number)
      : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
  let squares = 0
  for (const value of sorted) squares += (value - mean) ** 2
  return {
    count,
    min: sorted[0] as number,
    max: sorted[count - 1] as number,
    mean,
    median,
    stdDev: Math.sqrt(squares / count),
  }
}

// One metric's (base salary or total comp) woman-vs-man comparison for a
// group. gapPct is signed exactly like GenderGapResult.gapPct (positive =
// women earn less); gapKr is the same difference in currency units
// (menMean - womenMean). Means are null when that gender is absent; the gap
// is null when either mean is null or the men mean is 0.
export interface MetricComparison {
  womenMean: number | null
  menMean: number | null
  gapPct: number | null
  gapKr: number | null
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null
  let sum = 0
  for (const value of values) sum += value
  return sum / values.length
}

export function compareMetric(
  women: readonly number[],
  men: readonly number[]
): MetricComparison {
  const womenMean = mean(women)
  const menMean = mean(men)
  const comparable = womenMean !== null && menMean !== null && menMean !== 0
  return {
    womenMean,
    menMean,
    gapPct: comparable ? ((menMean - womenMean) / menMean) * 100 : null,
    gapKr: womenMean !== null && menMean !== null ? menMean - womenMean : null,
  }
}

// The DIRECTIONAL flag (ADR-0015): under the entry-condition model only a
// women-behind gap is a finding in the group views, so a zero or reversed
// gap reads "ok" here rather than borrowing classifyPayGap's
// both-directions magnitude (which the org-level aggregate keeps).
export function flagWomenBehind(
  womenCount: number,
  menCount: number,
  gapPct: number | null
): PayGapFlag {
  if (womenCount === 0 || menCount === 0 || gapPct === null) {
    return "insufficient"
  }
  if (gapPct <= 0) return "ok"
  return classifyPayGap(womenCount, menCount, gapPct)
}

// Which surface a comparison group belongs to (ADR-0015, Iteration 2 notes
// 1-3). "shown": the primary lika arbete flow (both genders, and the women
// trail on base salary, or on total comp for a tccDriven group). "reverse":
// both genders but the women lead on both metrics; the low-key info view.
// "genderPure": 2+ members of one gender; the opt-in deep-dive. "singleton":
// fewer than 2 members; silently dropped everywhere, including the gate.
export type EqualWorkOutcome = "shown" | "reverse" | "genderPure" | "singleton"

export interface EqualWorkClassification {
  outcome: EqualWorkOutcome
  // True when the group is shown on the total-comp gap alone (base gap is
  // zero or reversed): the base-only entry condition would hide a
  // bonus-driven gap, so total comp also admits (ADR-0015).
  tccDriven: boolean
  base: MetricComparison
  tcc: MetricComparison
  // The severest of the two metrics' directional flags: a finding on either
  // measure keeps its documentation duty.
  flag: PayGapFlag
}

const FLAG_SEVERITY: Record<PayGapFlag, number> = {
  critical: 3,
  elevated: 2,
  ok: 1,
  insufficient: 0,
}

function severest(a: PayGapFlag, b: PayGapFlag): PayGapFlag {
  return FLAG_SEVERITY[a] >= FLAG_SEVERITY[b] ? a : b
}

export function classifyEqualWorkGroup(input: {
  womenBase: readonly number[]
  menBase: readonly number[]
  womenTcc: readonly number[]
  menTcc: readonly number[]
}): EqualWorkClassification {
  const womenCount = input.womenBase.length
  const menCount = input.menBase.length
  const base = compareMetric(input.womenBase, input.menBase)
  const tcc = compareMetric(input.womenTcc, input.menTcc)
  const flag = severest(
    flagWomenBehind(womenCount, menCount, base.gapPct),
    flagWomenBehind(womenCount, menCount, tcc.gapPct)
  )
  const outcome: EqualWorkOutcome =
    womenCount + menCount < 2
      ? "singleton"
      : womenCount === 0 || menCount === 0
        ? "genderPure"
        : (base.gapPct ?? 0) > 0 || (tcc.gapPct ?? 0) > 0
          ? "shown"
          : "reverse"
  return {
    outcome,
    tccDriven: outcome === "shown" && (base.gapPct ?? 0) <= 0,
    base,
    tcc,
    flag,
  }
}

// One member's difference against the men's mean in their group (the detail
// view's per-person columns): negative kr = the member earns less than the
// men's average. pct is null when the men mean is 0 (undefined ratio).
export function diffVsMenMean(
  value: number,
  menMean: number
): { kr: number; pct: number | null } {
  return {
    kr: value - menMean,
    pct: menMean === 0 ? null : ((value - menMean) / menMean) * 100,
  }
}

// The tvärnivå check's inputs and outputs (Iteration 2 note 4): a woman on a
// HIGHER level (numerically LOWER: level 1 is highest) with a LOWER base
// salary than a man on a lower level is a structural warning sign. Members
// without a level or base salary cannot be placed and are skipped.
export interface CrossLevelMember {
  personPublicId: string
  gender: "Man" | "Kvinna"
  level: number | null
  trackKey: string
  base: number | null
}

export interface CrossLevelPair {
  manPublicId: string
  womanLevel: number
  manLevel: number
  womanBase: number
  manBase: number
  // How much more the lower-level man earns (always positive).
  diffKr: number
  // Same track removes the "different kind of job" explanation, so a
  // same-track pair is the stronger warning sign.
  sameTrack: boolean
}

// Aggregated per woman (not per pair): the pair count explodes
// quadratically on large orgs, so the views render one row per affected
// woman with the worst pair as the headline and the full list expandable.
export interface CrossLevelWoman {
  personPublicId: string
  level: number
  base: number
  outEarnedByCount: number
  worstPair: CrossLevelPair
  // Deterministic order: diff desc, then the man's publicId.
  pairs: CrossLevelPair[]
}

export function crossLevelPairs(
  members: readonly CrossLevelMember[]
): CrossLevelWoman[] {
  const placeable = members.filter(
    (m): m is CrossLevelMember & { level: number; base: number } =>
      m.level !== null && m.base !== null
  )
  const women = placeable.filter((m) => m.gender === "Kvinna")
  const men = placeable.filter((m) => m.gender === "Man")
  const result: CrossLevelWoman[] = []
  for (const woman of women) {
    const pairs = men
      .filter((man) => man.level > woman.level && man.base > woman.base)
      .map(
        (man): CrossLevelPair => ({
          manPublicId: man.personPublicId,
          womanLevel: woman.level,
          manLevel: man.level,
          womanBase: woman.base,
          manBase: man.base,
          diffKr: man.base - woman.base,
          sameTrack: man.trackKey === woman.trackKey,
        })
      )
      .sort((a, b) =>
        a.diffKr !== b.diffKr
          ? b.diffKr - a.diffKr
          : // Plain code-point order, never localeCompare: collation depends
            // on the host's ICU locale, and this module must return identical
            // results on client and server (publicIds are ASCII).
            a.manPublicId < b.manPublicId
            ? -1
            : 1
      )
    const worstPair = pairs[0]
    if (worstPair === undefined) continue
    result.push({
      personPublicId: woman.personPublicId,
      level: woman.level,
      base: woman.base,
      outEarnedByCount: pairs.length,
      worstPair,
      pairs,
    })
  }
  // Deterministic order: worst headline diff desc, then the woman's publicId.
  return result.sort((a, b) =>
    a.worstPair.diffKr !== b.worstPair.diffKr
      ? b.worstPair.diffKr - a.worstPair.diffKr
      : // Code-point order for the same determinism reason as above.
        a.personPublicId < b.personPublicId
        ? -1
        : 1
  )
}
