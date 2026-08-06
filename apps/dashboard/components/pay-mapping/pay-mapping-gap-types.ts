import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import type { PayGapReason } from "@workspace/constants"
import type { GenderTally, PayGapFlag } from "@workspace/core"

// Re-exported for the overview widgets (the wire's distribution buckets are
// index-aligned with @workspace/core's AGE_BUCKETS).
export type { GenderTally } from "@workspace/core"

// One metric's (base salary or total comp) woman-vs-man comparison in a
// group (ADR-0015). Means are null when that gender is absent or the group
// is masked; gapPct is signed (positive = women earn less), gapKr is the
// same difference in currency units.
export interface GapMetric {
  womenMean: number | null
  menMean: number | null
  gapPct: number | null
  gapKr: number | null
}

// Structural subset of getPayMappingGap's per-group result (the pay-gap
// aggregate for an equalWork/equivalentWork group). Shared by the overview
// headline, the analysis gap tables, and the run shell so all consumers use
// the same shape without importing runtime values from each other. Base
// salary is the primary measure, total comp rides alongside; the flag is
// the severest of the two directional flags; tccDriven marks a group
// admitted on the total-comp gap alone (ADR-0015).
export interface GapGroup {
  key: string
  roleTitle: string | null
  seniority: string | null
  level: number | null
  womenCount: number
  menCount: number
  base: GapMetric
  tcc: GapMetric
  flag: PayGapFlag
  tccDriven: boolean
}

// The group's primary display measure: base salary (grundlön), except for a
// tccDriven group, whose finding lives in total comp. Every finding
// sentence, bar pair, and attention sort reads this one helper so the
// primary metric can never drift between surfaces.
export function primaryGapMetric(
  group: Pick<GapGroup, "base" | "tcc" | "tccDriven">
): GapMetric {
  return group.tccDriven ? group.tcc : group.base
}

// A gender-pure (2+ members, one gender) equal-work group: out of the
// primary flow and the gate, listed for the opt-in deep-dive (ADR-0015).
export interface GenderPureGroupWire {
  key: string
  roleTitle: string | null
  seniority: string | null
  level: number | null
  gender: "Kvinna" | "Man"
  count: number
}

// What the entry conditions kept out of the primary lika arbete flow
// (ADR-0015): singletons reduce to a count (the report's methodology note),
// gender-pure groups feed the opt-in deep-dive, reverse groups (women lead
// on both metrics) feed the info view.
export interface ExcludedGroupsWire {
  singletonCount: number
  genderPure: GenderPureGroupWire[]
  reverse: GapGroup[]
}

// The org-level aggregate: the same shape as a GapGroup's counts/means/gap,
// without the group-identifying fields.
export interface OrgAggregate {
  womenCount: number
  menCount: number
  womenMeanComp: number | null
  menMeanComp: number | null
  gapPct: number | null
  flag: PayGapFlag
}

// One comparator in a women-dominated group's cross-level comparison
// (Diskrimineringslagen's third comparison): a non-dominated group at an
// equal-or-lower level whose whole-group mean out-earns the dominated group.
export interface WomenDominatedComparisonWire {
  key: string
  roleTitle: string | null
  seniority: string | null
  level: number
  headcount: number
  womenSharePct: number
  meanComp: number
  diffPct: number | null
  diffSek: number
}

// A women-dominated (>= 60% women) equal-work group plus the comparators
// that out-earn it.
export interface WomenDominatedGroupWire
  extends Omit<WomenDominatedComparisonWire, "diffPct" | "diffSek"> {
  comparisons: WomenDominatedComparisonWire[]
}

// getPayMappingGap's full return shape.
export interface PayMappingGapResult {
  currency: string | null
  org: OrgAggregate
  // The primary lika arbete flow: only groups passing the ADR-0015 entry
  // conditions.
  equalWork: GapGroup[]
  // What the entry conditions excluded (deep-dive, info view, methodology
  // count).
  excluded: ExcludedGroupsWire
  // Every priced, leveled row's per-level group, unconditionally (the
  // likvärdigt detail view applies its own entry conditions when it
  // renders).
  equivalentWork: GapGroup[]
  // The women-dominated cross-level comparison (Diskrimineringslagen's third
  // comparison), computed over the equal-work groups.
  womenDominated: WomenDominatedGroupWire[]
  // Gender headcounts of the whole frozen population (the "everyone" figure;
  // the gap stats cover priced rows only).
  population: GenderTally
  // Four rank quartiles of the priced population, lower -> upper (A3).
  quartiles: GenderTally[]
  // Age bands over the whole frozen population, aligned with AGE_BUCKETS;
  // rows without a parseable birth date are counted in `unknown`.
  age: { buckets: GenderTally[]; unknown: number }
}

// One row of the run's documentation (the objective reasons, deepened
// analysis, and Klarmarkerad state per equalWork/equivalentWork group, or
// the praxis/lönebestämmelser review's finding per area), the wire shape of
// listGroupAnalyses. `finding` is praxis-only: ReviewPraxisStep is the only
// reader/writer (the area's no-deficiencies/deficiencies-found verdict), and
// it is always null on equalWork/equivalentWork rows, which document
// themselves through `reasons` instead.
export interface GroupAnalysis {
  scope: "equalWork" | "equivalentWork" | "praxis"
  groupKey: string
  reasons: PayGapReason[]
  note: string | null
  done: boolean
  finding: "none" | "found" | null
}

// Structural subset of getPayMappingRunBySlug's per-person row (the frozen
// snapshot). currency/payYear are only present once a pay record was frozen;
// birthDate/employmentStartDate/ftePercent only when the source person had
// them (see payMapping/runs.ts). components is always present (empty when no
// pay was frozen); the scatter derives age/tenure from birthDate/
// employmentStartDate against the run's referenceDate.
export interface PayMappingSnapshotRow {
  displayName: string
  erased: boolean
  gender: "Man" | "Kvinna"
  roleTitle: string
  trackKey: string
  seniority: string
  level: number | null
  basicMonthly: number | null
  components: { kind: string; monthlyAmount: number }[]
  birthDate?: string
  employmentStartDate?: string
  ftePercent?: number
  currency?: string
  payYear?: number
}

// Structural subset of getPayMappingRunBySlug's return shape, kept local
// (like RoleProfile in role-profile-card.tsx) rather than importing the
// generated query type.
export interface PayMappingRunDetail {
  runId: Id<"payMappingRuns">
  label: string
  status: "active" | "paused" | "underReview" | "completed"
  // The freeze time (epoch ms): the scatter computes age/tenure at this
  // frozen date, never the live clock.
  referenceDate: number
  rows: PayMappingSnapshotRow[]
  // The samverkansredogörelse (who the employer cooperated with and how);
  // null until set. Participant names are statutory documentation content
  // on the run, never audited (see setPayMappingCollaboration).
  collaboration: { participants: string; description: string } | null
}
