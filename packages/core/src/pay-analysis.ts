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

// The p:th percentile (0-100) with linear interpolation between ranks, the
// convention Excel/SCB-style pay statistics use. Null for an empty list.
// Shared by the report's population spread table and the per-group P10-P90
// span, so the two can never compute a percentile differently.
export function percentileOf(
  values: readonly number[],
  p: number
): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0] as number
  const rank = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(rank)
  const upper = Math.ceil(rank)
  const weight = rank - lower
  return (
    (sorted[lower] as number) * (1 - weight) +
    (sorted[upper] as number) * weight
  )
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
// trail on total comp, or on base salary for a baseDriven group; ADR-0028).
// "reverse":
// both genders but the women lead on both metrics; the low-key info view.
// "genderPure": 2+ members of one gender; the opt-in deep-dive. "singleton":
// fewer than 2 members; silently dropped everywhere, including the gate.
export type EqualWorkOutcome = "shown" | "reverse" | "genderPure" | "singleton"

export interface EqualWorkClassification {
  outcome: EqualWorkOutcome
  // True when the group is shown on the base-salary gap alone (the
  // total-comp gap is zero or reversed): a pure total-comp condition would
  // hide a gap in the fixed pay that the women's variable pay happens to
  // cover, so base salary also admits, and the group's finding reads the
  // measure it was admitted on (ADR-0028).
  baseDriven: boolean
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
    baseDriven: outcome === "shown" && (tcc.gapPct ?? 0) <= 0,
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
