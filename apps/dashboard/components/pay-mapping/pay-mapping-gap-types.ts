import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import type { PayGapReason } from "@workspace/constants"
import type { GenderTally, PayGapFlag } from "@workspace/core"

// Re-exported for the overview widgets (the wire's distribution buckets are
// index-aligned with @workspace/core's AGE_BUCKETS).
export type { GenderTally } from "@workspace/core"

// Structural subset of getPayMappingGap's per-group result (the pay-gap
// aggregate for an equalWork/equivalentWork group). Shared by the overview
// headline, the analysis gap tables, and the run shell so all consumers use
// the same shape without importing runtime values from each other.
export interface GapGroup {
  key: string
  roleTitle: string | null
  level: string | null
  band: number | null
  womenCount: number
  menCount: number
  womenMeanComp: number | null
  menMeanComp: number | null
  gapPct: number | null
  flag: PayGapFlag
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
// (Diskrimineringslagen's third comparison): a non-dominated, equal-or-lower
// valued banded group whose whole-group mean out-earns the dominated group.
export interface WomenDominatedComparisonWire {
  key: string
  roleTitle: string | null
  level: string | null
  band: number
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
  equalWork: GapGroup[]
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
  level: string
  band: number | null
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
