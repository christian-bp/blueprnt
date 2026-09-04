// One status per equal-work group and per equivalent-work comparison,
// derived from the frozen gap, the documentation rows and the actions.
// Never stored: both report documents and, later, the overview redesign
// read it from here so the four words can never mean different things on
// two surfaces. Pure: no React, no Convex, no clock.
import type { PayGapReason } from "@workspace/constants"
import {
  equalWorkGroupRequiresDocumentation,
  womenDominatedGroupRequiresDocumentation,
} from "@workspace/core"
import type {
  GapGroup,
  GroupAnalysis,
  PayMappingActionWire,
  WomenDominatedGroupWire,
} from "./pay-mapping-gap-types"

export const ANALYSIS_STATUSES = [
  "noActionNeeded",
  "objectiveReason",
  "actionDecided",
  "furtherAnalysis",
] as const

export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number]

export interface AnalysisStatusInput {
  // Whether the row carries a documentation duty (a flagged equal-work
  // group; every comparison; a women-dominated group with comparisons).
  required: boolean
  done: boolean
  reasons: readonly PayGapReason[]
  note: string | null
  // At least one non-erased action targets the row.
  hasAction: boolean
}

// Precedence: a decided action is the strongest statement about a
// difference, whatever the documentation says; a row with no duty needs
// nothing; a done row explained by a reason or a written assessment is
// closed; everything else is still open.
export function analysisStatus(input: AnalysisStatusInput): AnalysisStatus {
  if (input.hasAction) return "actionDecided"
  if (!input.required) return "noActionNeeded"
  const documented =
    input.reasons.length > 0 ||
    (input.note !== null && input.note.trim() !== "")
  if (input.done && documented) return "objectiveReason"
  return "furtherAnalysis"
}

function liveActions(
  actions: readonly PayMappingActionWire[]
): PayMappingActionWire[] {
  return actions.filter((action) => !action.erased)
}

// The group's own documentation row (comparisonKey null).
function ownRow(
  analyses: readonly GroupAnalysis[],
  scope: "equalWork" | "equivalentWork",
  groupKey: string
): GroupAnalysis | undefined {
  return analyses.find(
    (row) =>
      row.scope === scope &&
      row.groupKey === groupKey &&
      row.comparisonKey === null
  )
}

export function equalWorkGroupStatus(
  group: Pick<GapGroup, "key" | "flag">,
  analyses: readonly GroupAnalysis[],
  actions: readonly PayMappingActionWire[]
): AnalysisStatus {
  const row = ownRow(analyses, "equalWork", group.key)
  // A group-targeted or a member-targeted action both answer the group's
  // difference.
  const hasAction = liveActions(actions).some(
    (action) =>
      (action.target.kind === "group" || action.target.kind === "person") &&
      action.target.scope === "equalWork" &&
      action.target.groupKey === group.key
  )
  return analysisStatus({
    required: equalWorkGroupRequiresDocumentation(group.flag),
    done: row?.done ?? false,
    reasons: row?.reasons ?? [],
    note: row?.note ?? null,
    hasAction,
  })
}

// A comparison is always a difference to assess (DL 3 kap. 9 §): its duty
// is unconditional, its done state is the group's own klarmarkering, and
// its reasons live on its own row.
export function comparisonStatus(
  group: Pick<WomenDominatedGroupWire, "key">,
  comparisonKey: string,
  analyses: readonly GroupAnalysis[],
  actions: readonly PayMappingActionWire[]
): AnalysisStatus {
  const own = ownRow(analyses, "equivalentWork", group.key)
  const row = analyses.find(
    (candidate) =>
      candidate.scope === "equivalentWork" &&
      candidate.groupKey === group.key &&
      candidate.comparisonKey === comparisonKey
  )
  const hasAction = liveActions(actions).some(
    (action) =>
      action.target.kind === "comparison" &&
      action.target.groupKey === group.key &&
      action.target.comparisonKey === comparisonKey
  )
  return analysisStatus({
    required: true,
    done: own?.done ?? false,
    reasons: row?.reasons ?? [],
    note: row?.note ?? null,
    hasAction,
  })
}

// The women-dominated group as a whole: no comparisons, no duty; otherwise
// its own row's state, with a group- or member-targeted action winning.
export function womenDominatedGroupStatus(
  group: Pick<WomenDominatedGroupWire, "key" | "comparisons">,
  analyses: readonly GroupAnalysis[],
  actions: readonly PayMappingActionWire[]
): AnalysisStatus {
  const row = ownRow(analyses, "equivalentWork", group.key)
  const hasAction = liveActions(actions).some(
    (action) =>
      (action.target.kind === "group" || action.target.kind === "person") &&
      action.target.scope === "equivalentWork" &&
      action.target.groupKey === group.key
  )
  return analysisStatus({
    required: womenDominatedGroupRequiresDocumentation(
      group.comparisons.length
    ),
    done: row?.done ?? false,
    reasons: row?.reasons ?? [],
    note: row?.note ?? null,
    hasAction,
  })
}

export function countByStatus(
  statuses: readonly AnalysisStatus[]
): Record<AnalysisStatus, number> {
  const counts = Object.fromEntries(
    ANALYSIS_STATUSES.map((status) => [status, 0])
  ) as Record<AnalysisStatus, number>
  for (const status of statuses) counts[status] += 1
  return counts
}
