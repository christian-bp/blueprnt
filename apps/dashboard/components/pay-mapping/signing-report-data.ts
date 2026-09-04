// The two projections of the unmasked report assembly (ADR-0030, approach
// C): the detail appendix is the identity projection; the signing report
// reduces everything to counts, shares, statuses and org-level aggregates.
// This module is the ONLY document projection that masks. Its output type
// has no field for a group-level amount, so a leak is a compile error
// rather than a review finding; the projection test string-scans the
// output as the second guard.
import { BASE_PRAXIS_AREA_KEYS, type PraxisAreaKey } from "@workspace/constants"
import {
  equalWorkGroupRequiresDocumentation,
  womenDominatedGroupRequiresDocumentation,
} from "@workspace/core"
import { EXPORT_MIN_GROUP_SIZE } from "@/lib/pay-mapping-masking"
import { type AnalysisStatus, countByStatus } from "./analysis-status"
import type {
  PayMappingReportDoc,
  ReportActionRow,
  ReportPraxisRow,
} from "./pay-mapping-report-data"

// The detail appendix prints the assembly as it is: every group, amount,
// reason, action and the frozen method. The alias and the identity function
// exist so the export seam names the projection it renders, and a future
// reduction has one place to live.
export type DetailAppendixDoc = PayMappingReportDoc

export function detailAppendixDoc(
  full: PayMappingReportDoc
): DetailAppendixDoc {
  return full
}

export const SIGNING_ACTION_AREAS = [
  "equalWork",
  "equivalentWork",
  "praxis",
] as const
export type SigningActionArea = (typeof SIGNING_ACTION_AREAS)[number]

export interface SigningMeasures {
  // Every mixed-gender group the analysis reached, in both directions: the
  // measure's label says "compared", so it counts what was compared.
  groups: number
  // Of those, the groups where the women lead on both measures: counted
  // here, but carrying no documentation duty (ADR-0015), which is why every
  // duty-bearing measure below stays on the women-behind subset.
  womenAhead: number
  required: number
  // Required groups marked done.
  assessed: number
  objectiveReasons: number
  actionsDecided: number
  // Groups the export thresholds bite (masked in this document, shown in
  // full in the appendix).
  insufficientBasis: number
  statuses: Record<AnalysisStatus, number>
}

export interface SigningEquivalentMeasures {
  womenDominatedGroups: number
  comparisons: number
  // Comparisons whose women-dominated group's analysis row is marked done.
  // Counted in comparisons, like the relevant-comparisons figure it is
  // reported against: the two are one "x of y" measure.
  comparisonsAssessed: number
  objectiveReasons: number
  // Comparison-anchored plus group-anchored measures: a women-dominated
  // group's measure may be anchored on one comparison, on the group itself
  // or on a member, and the group-level anchors carry no comparison status.
  actionsDecided: number
  statuses: Record<AnalysisStatus, number>
}

export interface SigningActionAreaRow {
  area: SigningActionArea
  // The aggregated observation the actions answer: required equal-work
  // groups, comparisons, or practice areas with a found deficiency.
  observations: number
  count: number
  notStarted: number
  inProgress: number
  done: number
  // Summed per unit, display text; null when no action in the area carries
  // a cost.
  cost: string | null
  earliest: string | null
  latest: string | null
}

export interface SigningPraxisRow {
  key: PraxisAreaKey
  finding: "none" | "found" | null
  done: boolean
  action: ReportPraxisRow["action"]
}

// Everything the signing report prints. Deliberately without any per-group
// field: no group name, no group amount, no person-near value can be
// expressed in this type.
export interface SigningReportDoc {
  status: "draft" | "final"
  runLabel: string
  currency: string | null
  identity: PayMappingReportDoc["identity"]
  population: PayMappingReportDoc["population"]
  payPosition: {
    womenShareOfMenMeanPct: string | null
    womenShareOfMenMedianPct: string | null
    // True when a gender has fewer priced rows than EXPORT_MIN_GROUP_SIZE.
    masked: boolean
  }
  quartiles: { women: number; men: number }[]
  exclusions: {
    withoutPay: number
    singletonCount: number
    genderPureCount: number
    maskedGroupCount: number
  }
  collaboration: PayMappingReportDoc["collaboration"]
  praxis: SigningPraxisRow[]
  equalWork: SigningMeasures
  equivalentWork: SigningEquivalentMeasures
  actionPlan: SigningActionAreaRow[]
  method: {
    criteria: { name: string; weightPoints: number }[]
    pointBudget: number
  }
  checklist: {
    allRequiredAssessed: boolean
    reasonsOrActionsLinked: boolean
    collaborationDocumented: boolean
    // Both documents derive from the one assembly of the one frozen run.
    sameFrozenVersion: true
  }
  openItems: { openAnalyses: number; actionsInProgress: number }
}

function actionArea(action: ReportActionRow): SigningActionArea {
  return action.scope
}

export function signingReportDoc(full: PayMappingReportDoc): SigningReportDoc {
  const payMasked =
    full.population.womenPriced < EXPORT_MIN_GROUP_SIZE ||
    full.population.menPriced < EXPORT_MIN_GROUP_SIZE

  // Comparable = every mixed-gender group the analysis reached, in both
  // directions; only gender-pure and singleton groups are not comparable and
  // they are counted in the exclusions. The duty-bearing measures below stay
  // on the flagged subset, because a women-ahead group carries no duty and
  // its hard-coded noActionNeeded status would inflate the buckets.
  const equalComparable = [...full.equalWork, ...full.reverseGroups]
  const equalRequired = full.equalWork.filter((row) =>
    equalWorkGroupRequiresDocumentation(row.flag)
  )
  const equalStatuses = full.equalWork.map((row) => row.status)
  const equalWork: SigningMeasures = {
    groups: equalComparable.length,
    womenAhead: full.reverseGroups.length,
    required: equalRequired.length,
    assessed: equalRequired.filter((row) => row.done).length,
    objectiveReasons: equalStatuses.filter(
      (status) => status === "objectiveReason"
    ).length,
    actionsDecided: equalStatuses.filter((status) => status === "actionDecided")
      .length,
    insufficientBasis: equalComparable.filter((row) => row.masked).length,
    statuses: countByStatus(equalStatuses),
  }

  const comparisons = full.womenDominated.flatMap((group) => group.comparisons)
  const comparisonStatuses = comparisons.map((row) => row.status)
  const womenDominatedStatuses = full.womenDominated.map(
    (group) => group.status
  )
  const equivalentWork: SigningEquivalentMeasures = {
    womenDominatedGroups: full.womenDominated.length,
    comparisons: comparisons.length,
    // A group with no comparisons contributes nothing either way, so the
    // duty predicate is not needed here: the done flag lives on the group
    // and covers every comparison under it.
    comparisonsAssessed: full.womenDominated
      .filter((group) => group.done)
      .reduce((sum, group) => sum + group.comparisons.length, 0),
    objectiveReasons: comparisonStatuses.filter(
      (status) => status === "objectiveReason"
    ).length,
    // Counting comparisons alone reported no decided measure while the
    // action plan showed one for the same area: the two derivations read
    // disjoint target kinds, so no action is counted twice.
    actionsDecided:
      comparisonStatuses.filter((status) => status === "actionDecided").length +
      womenDominatedStatuses.filter((status) => status === "actionDecided")
        .length,
    statuses: countByStatus(comparisonStatuses),
  }

  const praxis: SigningPraxisRow[] = BASE_PRAXIS_AREA_KEYS.map((key) => {
    const row = full.praxis.find((candidate) => candidate.key === key)
    return {
      key,
      finding: row?.finding ?? null,
      done: row?.done ?? false,
      action: row?.action ?? null,
    }
  })

  const observationsByArea: Record<SigningActionArea, number> = {
    equalWork: equalRequired.length,
    equivalentWork: comparisons.length,
    praxis: full.praxis.filter((row) => row.finding === "found").length,
  }
  const actionPlan: SigningActionAreaRow[] = SIGNING_ACTION_AREAS.map(
    (area) => {
      const rows = full.actions.filter((action) => actionArea(action) === area)
      const dates = rows.map((action) => action.plannedDateMs)
      const earliestMs = dates.length === 0 ? null : Math.min(...dates)
      const latestMs = dates.length === 0 ? null : Math.max(...dates)
      const byDate = (ms: number | null) =>
        ms === null
          ? null
          : (rows.find((action) => action.plannedDateMs === ms)?.plannedDate ??
            null)
      return {
        area,
        observations: observationsByArea[area],
        count: rows.length,
        notStarted: rows.filter((action) => action.status === "notStarted")
          .length,
        inProgress: rows.filter((action) => action.status === "inProgress")
          .length,
        done: rows.filter((action) => action.status === "done").length,
        cost: full.actionCostByScope[area],
        earliest: byDate(earliestMs),
        latest: byDate(latestMs),
      }
    }
  )

  const openAnalyses =
    equalStatuses.filter((status) => status === "furtherAnalysis").length +
    comparisonStatuses.filter((status) => status === "furtherAnalysis").length

  const closed = (status: AnalysisStatus) =>
    status === "objectiveReason" || status === "actionDecided"

  return {
    status: full.status,
    runLabel: full.runLabel,
    currency: full.currency,
    identity: full.identity,
    population: full.population,
    payPosition: {
      womenShareOfMenMeanPct: payMasked
        ? null
        : full.summary.womenShareOfMenMeanPct,
      womenShareOfMenMedianPct: payMasked
        ? null
        : full.summary.womenShareOfMenMedianPct,
      masked: payMasked,
    },
    quartiles: full.quartiles,
    exclusions: {
      withoutPay: full.population.total - full.population.priced,
      singletonCount: full.method.singletonCount,
      genderPureCount: full.method.genderPureCount,
      maskedGroupCount: full.method.maskedGroupCount,
    },
    collaboration: full.collaboration,
    praxis,
    equalWork,
    equivalentWork,
    actionPlan,
    method: {
      criteria: full.method.criteria.map((criterion) => ({
        name: criterion.name,
        weightPoints: criterion.weightPoints,
      })),
      pointBudget: full.method.pointBudget,
    },
    checklist: {
      allRequiredAssessed:
        equalRequired.every((row) => row.done) &&
        full.womenDominated
          .filter((group) =>
            womenDominatedGroupRequiresDocumentation(group.comparisons.length)
          )
          .every((group) => group.done),
      reasonsOrActionsLinked:
        equalRequired.every((row) => closed(row.status)) &&
        comparisons.every((row) => closed(row.status)),
      collaborationDocumented:
        full.collaboration !== null &&
        full.collaboration.participants.trim() !== "" &&
        full.collaboration.description.trim() !== "",
      sameFrozenVersion: true,
    },
    openItems: {
      openAnalyses,
      actionsInProgress: full.actions.filter(
        (action) => action.status === "inProgress"
      ).length,
    },
  }
}
