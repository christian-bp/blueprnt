import type { Doc, Id } from "@workspace/backend/convex/_generated/dataModel"
import { fteTotalMonthlyComp, type PayGapReason } from "@workspace/constants"
import type { GenderTally, PayGapFlag } from "@workspace/core"

// Re-exported for the overview widgets.
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
// the same shape without importing runtime values from each other. Total
// comp is the primary measure, base salary rides alongside; the flag is
// the severest of the two directional flags; baseDriven marks a group
// admitted on the base-salary gap alone (ADR-0015, measure per ADR-0028).
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
  baseDriven: boolean
}

// The group's primary display measure: total comp, except for a baseDriven
// group, whose finding lives in base salary (grundlön). Every badge, plot,
// member diff and attention sort reads this one helper so the primary
// metric can never drift between surfaces.
export function primaryGapMetric(
  group: Pick<GapGroup, "base" | "tcc" | "baseDriven">
): GapMetric {
  return group.baseDriven ? group.base : group.tcc
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
  // The comparator this row explains, on an equivalentWork row that documents
  // ONE comparison (DL 3 kap. 9 § asks about each difference separately).
  // Null on the group's own row, which carries the klarmarkering and the
  // summary note, and on every equalWork/praxis row.
  comparisonKey: string | null
  reasons: PayGapReason[]
  note: string | null
  done: boolean
  finding: "none" | "found" | null
}

// What an action or note is anchored to (ADR-0015): a whole comparison
// group, one individual within a group, or a tvärnivå pair. Individuals are
// referenced by personPublicId only (Role != Person); display values come
// from the snapshot row.
export type ActionTargetWire =
  | { kind: "group"; scope: "equalWork" | "equivalentWork"; groupKey: string }
  | {
      kind: "person"
      scope: "equalWork" | "equivalentWork"
      groupKey: string
      personPublicId: string
    }
  | { kind: "comparison"; groupKey: string; comparisonKey: string }

export type ActionStatus = "notStarted" | "inProgress" | "done"
export type ActionPriority = "high" | "medium" | "low"
export type NoteType = "objectiveReason" | "discussionNeeded" | "noActionNeeded"

// The recurrence a cost figure is expressed in, from the backend validator
// (type-only import keeps Convex out of the client bundle); the value list
// below feeds the select options and is drift-guarded against the union.
export type CostUnit = Doc<"payMappingActions">["estimatedCostUnit"] & string
export const COST_UNITS = [
  "oneOff",
  "perMonth",
  "perYear",
] as const satisfies readonly CostUnit[]
type _CostUnitsComplete = CostUnit extends (typeof COST_UNITS)[number]
  ? true
  : never
const _assertCostUnits: _CostUnitsComplete = true
void _assertCostUnits

// listActions' wire shape: a formal remediation action (åtgärd, DL 3 kap.
// 11 §). ownerName resolves at read time, so an erased or renamed owner
// never leaves a stale name frozen on the row.
export interface PayMappingActionWire {
  actionId: Id<"payMappingActions">
  target: ActionTargetWire
  problem: string
  plannedAction: string
  reason: PayGapReason | null
  ownerUserId: string
  ownerName: string
  plannedDate: number
  estimatedCost: number | null
  // Null exactly when estimatedCost is (the mutations enforce the pairing).
  estimatedCostUnit: CostUnit | null
  priority: ActionPriority
  status: ActionStatus
  // ADR-0027: the row was erasure-tombstoned (free text cleared); surfaces
  // render the tombstone marker instead of the empty strings.
  erased: boolean
  createdAt: number
}

// listNotes' wire shape: an informal note (notering) with its three-way
// classification.
export interface PayMappingNoteWire {
  noteId: Id<"payMappingNotes">
  target: ActionTargetWire
  text: string
  noteType: NoteType
  // ADR-0027: erasure-tombstoned, see PayMappingActionWire.erased.
  erased: boolean
  createdBy: string
  createdByName: string
  createdAt: number
}

// Whether a record is anchored to exactly this target: the detail views' own
// per-group and per-row filter, so a badge never counts a sibling's records.
export function targetMatches(
  target: ActionTargetWire,
  match: ActionTargetWire
): boolean {
  if (target.kind !== match.kind) return false
  if (target.kind === "comparison" && match.kind === "comparison") {
    return (
      target.groupKey === match.groupKey &&
      target.comparisonKey === match.comparisonKey
    )
  }
  if (target.kind === "group" && match.kind === "group") {
    return target.scope === match.scope && target.groupKey === match.groupKey
  }
  if (target.kind === "person" && match.kind === "person") {
    return (
      target.scope === match.scope &&
      target.groupKey === match.groupKey &&
      target.personPublicId === match.personPublicId
    )
  }
  return false
}

// Structural subset of getPayMappingRunBySlug's per-person row (the frozen
// snapshot). currency/payYear are only present once a pay record was frozen;
// birthDate/employmentStartDate/ftePercent only when the source person had
// them (see payMapping/runs.ts). components is always present (empty when no
// pay was frozen); the scatter derives age/tenure from birthDate/
// employmentStartDate against the run's referenceDate.
export interface PayMappingSnapshotRow {
  // The pseudonymous person key: per-individual actions and notes anchor to
  // it (never a name).
  personPublicId: string
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

// The shared role+seniority display label for an equal-work group, a
// women-dominated group, or one of its comparators: every heading, finding
// sentence, and checklist row renders the same "roleTitle · seniority" text.
export function groupLabel(group: {
  roleTitle: string | null
  seniority: string | null
}): string {
  return [group.roleTitle, group.seniority]
    .filter((part) => part !== null)
    .join(" · ")
}

// The group a work-layer record is anchored to, as display text. A
// person-targeted record still reads by its GROUP (the group key is the only
// display value the target carries; the person's own name lives in the
// detail view, never denormalized here). A comparison reads by the job it
// compares AGAINST: that is the row the reader documented. Shared by the
// actions overview and the report assembly so the derivation cannot drift.
export function targetGroupLabel(target: ActionTargetWire): string {
  const key =
    target.kind === "comparison" ? target.comparisonKey : target.groupKey
  // A group key is roleTitle|level (ADR-0017), so the title alone names it.
  const [roleTitle] = key.split("|")
  return groupLabel({ roleTitle: roleTitle ?? null, seniority: null })
}

// A member's FTE-adjusted base salary and total compensation: the SAME
// derivation the backend engine uses (gap.ts), shared here so no view can
// silently diverge from the engine's numbers (e.g. by forgetting the
// empty components array in the base case).
export function fteBaseMonthly(row: PayMappingSnapshotRow): number {
  return fteTotalMonthlyComp(row.basicMonthly ?? 0, [], row.ftePercent)
}

export function fteTotalMonthly(row: PayMappingSnapshotRow): number {
  return fteTotalMonthlyComp(
    row.basicMonthly ?? 0,
    row.components,
    row.ftePercent
  )
}

// Whether a frozen row belongs to a group: roleTitle + level, matching the
// engine's own group key (ADR-0017). Seniority is NOT part of it, because a
// group spans every step in its title at this level and carries none of its
// own; matching on it compares a group's null against a person's real step
// and finds nobody.
//
// The ONE identity test. Every surface that has to decide "is this person in
// this group" reads it, so the answer cannot differ between the members a
// plot draws and the group a point is labelled with. It already did once:
// the scatter's label builder kept a seniority clause after this rule
// dropped it, so every point got an empty label and selecting a row in the
// table dimmed the whole plot instead of lighting one job up.
export function rowInGroup(
  row: PayMappingSnapshotRow,
  group: { roleTitle: string | null; level: number | null }
): boolean {
  return row.roleTitle === group.roleTitle && row.level === group.level
}

// A group's own frozen, priced members. Shared by the equal-work detail
// view and the equivalent-work underlag so member matching never drifts
// between callers.
export function groupMembers(
  rows: PayMappingSnapshotRow[] | undefined,
  group: {
    roleTitle: string | null
    seniority: string | null
    level: number | null
  }
): PayMappingSnapshotRow[] | undefined {
  return rows?.filter(
    (row) => rowInGroup(row, group) && row.basicMonthly !== null
  )
}

// A gap group's own frozen, priced members, never null. The single entry
// point, so the dot plot and the member table can never pick members
// differently for the same group. It used to dispatch on the group's shape
// too, because a per-level likvärdigt group (null roleTitle and seniority,
// a concrete level) selects by level alone; nothing renders those now.
export function membersOf(
  rows: PayMappingSnapshotRow[] | undefined,
  group: {
    roleTitle: string | null
    seniority: string | null
    level: number | null
  }
): PayMappingSnapshotRow[] {
  return groupMembers(rows, group) ?? []
}

// Structural subset of getPayMappingRunBySlug's return shape, kept local
// (like RoleProfile in role-profile-card.tsx) rather than importing the
// generated query type.
// The run's lifecycle status, derived from the backend schema so the wire
// shapes cannot drift from the validator's literal list.
export type PayMappingRunStatus = Doc<"payMappingRuns">["status"]

export interface PayMappingRunDetail {
  runId: Id<"payMappingRuns">
  label: string
  status: PayMappingRunStatus
  // The freeze time (epoch ms): the scatter computes age/tenure at this
  // frozen date, never the live clock.
  referenceDate: number
  // The frozen headcount. Same field the run list reports, so the overview's
  // population card compares like with like across mappings.
  populationCount: number
  rows: PayMappingSnapshotRow[]
  // The samverkansredogörelse (who the employer cooperated with and how);
  // null until set. Participant names are statutory documentation content
  // on the run, never audited (see setPayMappingCollaboration).
  collaboration: { participants: string; description: string } | null
  // The frozen model's criteria (name + weight points, evidence order): the
  // report's method section cites the method the run was computed under,
  // never the live model (ADR-0008).
  frozenCriteria: { name: string; weightPoints: number }[]
}
