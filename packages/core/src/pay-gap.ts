// Deterministic gender pay-gap engine for the lönekartläggning P1 primary view
// (ADR-0012). Pure and side-effect-free (ADR-0002): the same math runs on the
// server (the aggregate query) and could run identically on the client. The
// FTE/total-comp formula is NOT re-derived here; callers pass values already
// computed with fteTotalMonthlyComp (@workspace/constants/pay).

export type PayGapFlag = "critical" | "elevated" | "ok" | "insufficient"

export interface GenderGapResult {
  womenCount: number
  menCount: number
  // Mean FTE-adjusted total comp per gender; null when that gender is absent.
  womenMeanComp: number | null
  menMeanComp: number | null
  // Signed gap %: positive = women earn less than men. Null when either mean
  // is null or the men mean is 0 (undefined ratio).
  gapPct: number | null
  flag: PayGapFlag
}

// The single source of the flag thresholds (ADR-0012), consumed by the
// aggregate query. A group is insufficient only when a
// gender is missing: with at least one woman and one man there is a real
// comparison, and the in-app audience (HR) already sees every salary, so a
// group-size minimum here would only hide signal. The small-cell minimums
// (>= 4 people and >= 2 per gender) are an EXPORT-boundary concern, applied
// where aggregates leave the HR context (see the go-live checklist). Flags
// on the gap's magnitude: an unexplained gap in either direction is a
// finding.
export function classifyPayGap(
  womenCount: number,
  menCount: number,
  gapPct: number | null
): PayGapFlag {
  if (womenCount === 0 || menCount === 0 || gapPct === null) {
    return "insufficient"
  }
  const magnitude = Math.abs(gapPct)
  if (magnitude > 10) return "critical"
  if (magnitude >= 5) return "elevated"
  return "ok"
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null
  let sum = 0
  for (const value of values) sum += value
  return sum / values.length
}

// Given the per-person FTE-adjusted total-comp values already split by gender,
// return counts, per-gender means, the signed gap %, and the flag.
export function computeGenderGap(
  womenComp: number[],
  menComp: number[]
): GenderGapResult {
  const womenMeanComp = mean(womenComp)
  const menMeanComp = mean(menComp)
  const gapPct =
    womenMeanComp !== null && menMeanComp !== null && menMeanComp !== 0
      ? ((menMeanComp - womenMeanComp) / menMeanComp) * 100
      : null
  return {
    womenCount: womenComp.length,
    menCount: menComp.length,
    womenMeanComp,
    menMeanComp,
    gapPct,
    flag: classifyPayGap(womenComp.length, menComp.length, gapPct),
  }
}

// Per-gender headcounts for one distribution bucket (a pay quartile or an
// age band). Counts only, never pay values.
export interface GenderTally {
  women: number
  men: number
}

// Per-pay-quartile gender headcounts (EU Art. 9 A3, the glass-ceiling view):
// everyone is ranked by comp ascending and split into four rank quartiles.
// Index 0 = the lower quartile, 3 = the upper. Deterministic: ties keep the
// ascending sort's stable order.
export function quartileGenderTallies(
  entries: ReadonlyArray<{ comp: number; woman: boolean }>
): GenderTally[] {
  const tallies: GenderTally[] = Array.from({ length: 4 }, () => ({
    women: 0,
    men: 0,
  }))
  const sorted = [...entries].sort((a, b) => a.comp - b.comp)
  const n = sorted.length
  sorted.forEach((entry, rank) => {
    const quartile = Math.min(3, Math.floor((rank * 4) / n))
    const tally = tallies[quartile]
    if (tally === undefined) return
    if (entry.woman) tally.women += 1
    else tally.men += 1
  })
  return tallies
}

// The fixed age bands of the age-distribution view, aligned by index with
// ageGenderTallies' buckets. Digit-only labels, so they render as-is in
// every locale.
export const AGE_BUCKETS = [
  "0-19",
  "20-29",
  "30-39",
  "40-49",
  "50-59",
  "60-69",
  "70+",
] as const

// Full years of age at `asOfMs`, from an ISO birth-date string. Null when the
// date does not parse or lies in the future. Pure: the reference instant is
// an input, never the clock. Also used for tenure (years since
// employmentStartDate): the same whole-years-at-instant math applies.
export function ageAt(birthDate: string, asOfMs: number): number | null {
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return null
  const asOf = new Date(asOfMs)
  let age = asOf.getUTCFullYear() - birth.getUTCFullYear()
  const beforeBirthday =
    asOf.getUTCMonth() < birth.getUTCMonth() ||
    (asOf.getUTCMonth() === birth.getUTCMonth() &&
      asOf.getUTCDate() < birth.getUTCDate())
  if (beforeBirthday) age -= 1
  return age < 0 ? null : age
}

function ageBucketIndex(age: number): number {
  if (age < 20) return 0
  if (age < 30) return 1
  if (age < 40) return 2
  if (age < 50) return 3
  if (age < 60) return 4
  if (age < 70) return 5
  return 6
}

// Per-age-band gender headcounts at a reference instant (buckets aligned with
// AGE_BUCKETS). Entries without a parseable birth date land in `unknown`
// instead of being silently dropped.
export function ageGenderTallies(
  entries: ReadonlyArray<{ birthDate: string | undefined; woman: boolean }>,
  asOfMs: number
): { buckets: GenderTally[]; unknown: number } {
  const buckets: GenderTally[] = Array.from(
    { length: AGE_BUCKETS.length },
    () => ({ women: 0, men: 0 })
  )
  let unknown = 0
  for (const entry of entries) {
    const age =
      entry.birthDate === undefined ? null : ageAt(entry.birthDate, asOfMs)
    if (age === null) {
      unknown += 1
      continue
    }
    const bucket = buckets[ageBucketIndex(age)]
    if (bucket === undefined) continue
    if (entry.woman) bucket.women += 1
    else bucket.men += 1
  }
  return { buckets, unknown }
}

// DO praxis: a group "brukar anses" women-dominated at 60 % women or more.
export const WOMEN_DOMINANCE_THRESHOLD = 0.6

export function isWomenDominated(
  womenCount: number,
  menCount: number
): boolean {
  const total = womenCount + menCount
  return total > 0 && womenCount / total >= WOMEN_DOMINANCE_THRESHOLD
}

// A group as the cross-level comparison sees it: identity + counts + the
// whole-group mean of the gap measure (callers compute the mean; the engine
// never re-derives comp).
export interface ComparableGroup {
  key: string
  roleTitle: string | null
  level: string | null
  band: number | null
  womenCount: number
  menCount: number
  meanComp: number | null
}

export interface WomenDominatedComparison {
  key: string
  roleTitle: string | null
  level: string | null
  band: number
  headcount: number
  womenSharePct: number
  meanComp: number
  // Positive: the equally or lower-valued group out-earns the dominated one.
  diffPct: number | null
  diffSek: number
}

export interface WomenDominatedGroup {
  key: string
  roleTitle: string | null
  level: string | null
  band: number
  headcount: number
  womenSharePct: number
  meanComp: number
  comparisons: WomenDominatedComparison[]
}

function womenSharePct(womenCount: number, menCount: number): number {
  return (womenCount / (womenCount + menCount)) * 100
}

// Diskrimineringslagen's third comparison: every women-dominated group with a
// band, against every NON-women-dominated banded group of equal or LOWER
// value (band 1 is highest, so numerically >=) whose whole-group mean is
// HIGHER. Groups without a band or mean cannot be placed and are skipped (the
// pay-mapping preconditions gate now blocks a run at start whenever any
// staffed role would resolve no band, so this filter guards a case the gate
// already prevents rather than one that reaches production data). Deterministic
// ordering: output by comparison count desc, then band asc, then key;
// comparisons by band asc (higher value first), then diffSek desc.
export function womenDominatedComparisons(
  groups: readonly ComparableGroup[]
): WomenDominatedGroup[] {
  const placeable = groups.filter(
    (g): g is ComparableGroup & { band: number; meanComp: number } =>
      g.band !== null && g.meanComp !== null
  )
  const dominated = placeable.filter((g) =>
    isWomenDominated(g.womenCount, g.menCount)
  )
  const others = placeable.filter(
    (g) => !isWomenDominated(g.womenCount, g.menCount)
  )
  const result = dominated.map((group) => ({
    key: group.key,
    roleTitle: group.roleTitle,
    level: group.level,
    band: group.band,
    headcount: group.womenCount + group.menCount,
    womenSharePct: womenSharePct(group.womenCount, group.menCount),
    meanComp: group.meanComp,
    comparisons: others
      .filter((o) => o.band >= group.band && o.meanComp > group.meanComp)
      .map((o) => ({
        key: o.key,
        roleTitle: o.roleTitle,
        level: o.level,
        band: o.band,
        headcount: o.womenCount + o.menCount,
        womenSharePct: womenSharePct(o.womenCount, o.menCount),
        meanComp: o.meanComp,
        diffSek: o.meanComp - group.meanComp,
        diffPct:
          group.meanComp === 0
            ? null
            : ((o.meanComp - group.meanComp) / group.meanComp) * 100,
      }))
      .sort((a, b) =>
        a.band !== b.band ? a.band - b.band : b.diffSek - a.diffSek
      ),
  }))
  return result.sort((a, b) => {
    if (a.comparisons.length !== b.comparisons.length)
      return b.comparisons.length - a.comparisons.length
    if (a.band !== b.band) return a.band - b.band
    return a.key.localeCompare(b.key)
  })
}

// The ADR-0012 gate's per-group rule, shared by the backend mutations and the
// UI (an equal-work group needs a documented reason unless it is ok; a
// women-dominated group needs one when something out-earns it).
export function equalWorkGroupRequiresDocumentation(flag: PayGapFlag): boolean {
  return flag !== "ok"
}

export function womenDominatedGroupRequiresDocumentation(
  comparisonCount: number
): boolean {
  return comparisonCount > 0
}
