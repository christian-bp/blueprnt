// Assembly of the pay-mapping report content: a pure mapping from the run's
// frozen data + work layer to the typed doc both PDF documents project
// from. Everything display-formatted is formatted HERE through injected
// formatters (locale-aware money/percent/date), so the templates stay
// layout-only and this step is unit-testable with identity formatters.
// Engine-agnostic by design (ADR-0026): nothing in this module knows which
// PDF engine renders the doc.
//
// UNMASKED by design (ADR-0030): this doc never nulls a value for size. It
// still computes the export-threshold flags (`masked`, `maskedGroupCount`)
// so the signing projection (signing-report-data.ts, the ONLY place masking
// exists) can decide what leaves the HR context; the detail appendix prints
// everything.
import type { PayGapReason, PraxisAreaKey } from "@workspace/constants"
import { BASE_PRAXIS_AREA_KEYS } from "@workspace/constants"
import type { PayGapFlag } from "@workspace/core"
import { genderStats, percentileOf } from "@workspace/core"
import type { useTranslations } from "next-intl"
import {
  EXPORT_MIN_GROUP_SIZE,
  exportMasksGenderMeans,
  exportMasksWholeGroupMean,
} from "@/lib/pay-mapping-masking"
import type {
  ActionPriority,
  ActionStatus,
  CostUnit,
  GapGroup,
  GapMetric,
  GroupAnalysis,
  NoteType,
  PayMappingActionWire,
  PayMappingGapResult,
  PayMappingNoteWire,
  PayMappingRunDetail,
  PayMappingSnapshotRow,
  WomenDominatedGroupWire,
} from "./pay-mapping-gap-types"
import {
  COST_UNITS,
  fteBaseMonthly,
  fteTotalMonthly,
  groupLabel,
  isHourlyRow,
  rowInGroup,
  targetGroupLabel,
  targetMatches,
} from "./pay-mapping-gap-types"
import {
  type AnalysisStatus,
  comparisonStatus,
  equalWorkGroupStatus,
  womenDominatedGroupStatus,
} from "./analysis-status"

// The export floor for the organization-level variable-pay figures: a
// gender with fewer priced people than the group minimum loses every figure
// (with a tiny gender the share itself attributes a pay component to
// identifiable individuals), and a gender with fewer receivers than the
// minimum keeps its share but loses the amounts (a mean over three receivers
// approaches one person's bonus). The stats themselves stay raw; every
// surface that leaves the HR context applies this before printing.
export function floorVariablePayStats(
  stats: OrgVariablePayStats
): OrgVariablePayStats {
  const floor = (
    priced: number,
    receivers: number,
    figures: {
      sharePct: number | null
      mean: number | null
      median: number | null
    }
  ) => {
    if (priced < EXPORT_MIN_GROUP_SIZE) {
      return { sharePct: null, mean: null, median: null }
    }
    if (receivers < EXPORT_MIN_GROUP_SIZE) {
      return { sharePct: figures.sharePct, mean: null, median: null }
    }
    return figures
  }
  const women = floor(stats.womenPriced, stats.womenReceivers, {
    sharePct: stats.womenSharePct,
    mean: stats.womenMean,
    median: stats.womenMedian,
  })
  const men = floor(stats.menPriced, stats.menReceivers, {
    sharePct: stats.menSharePct,
    mean: stats.menMean,
    median: stats.menMedian,
  })
  return {
    ...stats,
    womenSharePct: women.sharePct,
    menSharePct: men.sharePct,
    womenMean: women.mean,
    menMean: men.mean,
    womenMedian: women.median,
    menMedian: men.median,
  }
}

// Locale-aware display formatting, injected so the assembly stays pure. pct
// takes a 0-100 figure (the wire's unit) and renders unsigned: direction is
// carried by the section and the status word, never by a lone minus sign
// that its section does not explain. money renders in the run's currency;
// date takes epoch ms.
export interface ReportFormatters {
  money: (value: number) => string
  pct: (value: number) => string
  date: (epochMs: number) => string
  // Date and time of day, for the extraction instant (the freeze).
  dateTime: (epochMs: number) => string
  // "/mo" style recurrence suffix for a cost figure; empty for a lump sum,
  // so money(x) + costUnitSuffix(unit) is the one composition everywhere.
  costUnitSuffix: (unit: CostUnit | null) => string
}

// One metric's cells as display text; null renders as the masked/absent dash.
export interface ReportMetricText {
  womenMean: string | null
  menMean: string | null
  gapPct: string | null
  gapKr: string | null
}

// The per-gender medians beside the means (professional standard: both
// measures, per Unionen/Sveriges Ingenjörer and DO-recommended practice in
// published municipal documents).
export interface ReportMedianText {
  women: string | null
  men: string | null
  gapPct: string | null
}

// An action cited from a group or comparison row: its number (the id both
// documents print), the owner and the planned date. The action's own row
// in the action table carries the rest.
export interface ReportLinkedAction {
  number: number
  ownerName: string
  plannedDate: string
}

export interface ReportGroupRow {
  key: string
  label: string
  level: number | null
  womenCount: number
  menCount: number
  // The export threshold (signing-report-data.ts) bites this row. A flag
  // only: the figures below are always present.
  masked: boolean
  // The table's figures: total comp (the primary measure) with its medians,
  // and base salary beside it for the baseDriven meta line.
  tcc: ReportMetricText
  tccMedian: ReportMedianText
  base: ReportMetricText
  flag: PayGapFlag
  baseDriven: boolean
  // The same group's mean total-comp gap in the PREVIOUS completed
  // kartläggning, when that run had the group (year-over-year figures in the
  // tables, the near-universal convention in published documents).
  previousGapPct: string | null
  reasons: PayGapReason[]
  note: string | null
  done: boolean
  status: AnalysisStatus
  actions: ReportLinkedAction[]
}

export interface ReportComparisonRow {
  key: string
  label: string
  level: number
  headcount: number
  womenSharePct: string
  meanComp: string | null
  // P10-P90 span of the whole group's total compensation: lönespridning for
  // the likvärdigt comparison (recommended practice, not a statutory duty;
  // sources in docs/lonekartlaggning-rapport-kravbild.md). Percentiles
  // rather than min/max so the span never prints an individual's exact
  // salary.
  spread: string | null
  diffPct: string | null
  diffKr: string | null
  masked: boolean
  reasons: PayGapReason[]
  note: string | null
  status: AnalysisStatus
  actions: ReportLinkedAction[]
}

export interface ReportWomenDominatedGroup {
  key: string
  label: string
  level: number
  headcount: number
  womenSharePct: string
  meanComp: string | null
  spread: string | null
  masked: boolean
  reasons: PayGapReason[]
  note: string | null
  done: boolean
  // The group's OWN status, which its comparisons cannot carry: a measure
  // for a women-dominated group may be anchored on the group or on one of
  // its members rather than on a single comparison.
  status: AnalysisStatus
  actions: ReportLinkedAction[]
  comparisons: ReportComparisonRow[]
}

// A single-gender equal-work group, listed by identity and count (its
// figures never enter the export: with one gender there is no woman-man
// comparison, and a "mean" would restate that gender's pay).
export interface ReportGenderPureRow {
  key: string
  label: string
  level: number | null
  gender: "Kvinna" | "Man"
  count: number
}

export interface ReportActionRow {
  id: string
  number: number
  kind: "group" | "person" | "comparison" | "praxis"
  // Which statutory comparison the measure belongs to: the action table
  // groups by it (a comparison target always belongs to the women-dominated
  // chapter).
  scope: "equalWork" | "equivalentWork" | "praxis"
  label: string
  problem: string
  plannedAction: string
  reason: PayGapReason | null
  ownerName: string
  plannedDate: string
  // The raw instant behind plannedDate, for the signing plan's date range.
  plannedDateMs: number
  cost: string | null
  // The raw cost and its unit behind `cost`, for per-area roll-ups.
  costAmount: number | null
  costUnit: CostUnit | null
  priority: ActionPriority
  status: ActionStatus
  // ADR-0027: erasure-tombstoned row; the template renders the tombstone
  // marker instead of the (cleared) free text.
  erased: boolean
}

export interface ReportNoteRow {
  id: string
  label: string
  noteType: NoteType
  text: string
  authorName: string
  date: string
  // ADR-0027: erasure-tombstoned, see ReportActionRow.erased.
  erased: boolean
}

export interface ReportPraxisRow {
  key: PraxisAreaKey
  finding: "none" | "found" | null
  note: string | null
  done: boolean
  // The first non-erased action anchored to the area, or null.
  action: { number: number; plannedAction: string; plannedDate: string } | null
}

export interface ReportPreviousEvaluation {
  runLabel: string
  referenceDate: string
  finding: "none" | "found" | null
  note: string | null
  actions: {
    id: string
    number: number
    label: string
    plannedAction: string
    status: ActionStatus
    plannedDate: string
    cost: string | null
    // ADR-0027: erasure-tombstoned, see ReportActionRow.erased.
    erased: boolean
  }[]
}

export interface PayMappingReportDoc {
  status: "draft" | "final"
  runLabel: string
  referenceDate: string
  currency: string | null
  population: {
    total: number
    women: number
    men: number
    priced: number
    womenPriced: number
    menPriced: number
  }
  // The identity block's raw parts, formatted; the templates compose the
  // labeled lines.
  identity: {
    systemVersion: string
    approvedAt: string | null
    referenceDate: string
    extractedAt: string
  }
  quartiles: { women: number; men: number }[]
  collaboration: {
    participants: string
    description: string
    date: string | null
    // The parties' own samverkanssynpunkter, printed in the appendix's
    // practice chapter; null when none were recorded.
    remarks: string | null
  } | null
  // The base review areas only; previousActions renders as the evaluation
  // section below, never as a praxis row.
  praxis: ReportPraxisRow[]
  equalWork: ReportGroupRow[]
  // What the entry conditions kept out of the primary flow, listed by
  // identity so no group silently disappears from the written documentation
  // (published documents list every group; ADR-0015 keeps singletons as a
  // count by design).
  reverseGroups: ReportGroupRow[]
  genderPureGroups: ReportGenderPureRow[]
  womenDominated: ReportWomenDominatedGroup[]
  actions: ReportActionRow[]
  // The two org-level share figures the signing projection reads, derived
  // from the same aggregates the sections render.
  summary: {
    // Women's mean/median pay as a percent of men's (the professional
    // template convention; 100 = parity). The signing projection applies the
    // org-median floor.
    womenShareOfMenMeanPct: string | null
    womenShareOfMenMedianPct: string | null
  }
  actionTotals: {
    count: number
    cost: string | null
    notStarted: number
    inProgress: number
    done: number
  }
  // The cost roll-up per chapter (the signing plan's per-area figure),
  // through the same costTotalsText as actionTotals.cost.
  actionCostByScope: Record<
    "equalWork" | "equivalentWork" | "praxis",
    string | null
  >
  notes: ReportNoteRow[]
  previousEvaluation: ReportPreviousEvaluation | null
  // The run's resolved full-time hours per month at freeze time (the method
  // section's conversion-factor note), mirrored from PayMappingRunDetail so
  // the template need not thread the run itself through.
  fullTimeHoursDefault: number
  method: {
    criteria: {
      name: string
      dimensionKey: string | null
      weightPoints: number
      sharePct: string
      // The frozen documentation the appendix's method chapter prints under
      // each criterion; null when the frozen model carried none.
      purpose: string | null
      whyRelevant: string | null
      weightMotivation: string | null
    }[]
    // Weight share per dimension, in first-appearance order of the
    // dimensions among the criteria.
    dimensionShares: { dimensionKey: string; sharePct: string }[]
    pointBudget: number
    levelRules: { level: number; minScore: number }[]
    zoneProfileRules: { zone: string; minStep: number }[]
    workingConditions: {
      status: "active" | "testedNotMaterial"
      motivation: string
    } | null
    approvedAt: string | null
    maskedGroupCount: number
    singletonCount: number
    genderPureCount: number
    reverseCount: number
    hourlyRowCount: number
    ownHoursCount: number
  }
}

// Every figure renders unsigned: direction is carried by the section and the
// status word, never by a lone minus sign that its section does not explain.
function metricText(
  metric: GapMetric,
  formatters: ReportFormatters
): ReportMetricText {
  return {
    womenMean:
      metric.womenMean === null ? null : formatters.money(metric.womenMean),
    menMean: metric.menMean === null ? null : formatters.money(metric.menMean),
    gapPct: metric.gapPct === null ? null : formatters.pct(metric.gapPct),
    gapKr:
      metric.gapKr === null ? null : formatters.money(Math.abs(metric.gapKr)),
  }
}

// The documentation row for one target, read out of the run's analyses. The
// group's own row carries comparisonKey null; a comparison's row carries the
// comparator's key.
function analysisFor(
  analyses: GroupAnalysis[],
  scope: GroupAnalysis["scope"],
  groupKey: string,
  comparisonKey: string | null = null
): GroupAnalysis | undefined {
  return analyses.find(
    (row) =>
      row.scope === scope &&
      row.groupKey === groupKey &&
      row.comparisonKey === comparisonKey
  )
}

// The non-erased actions matching a predicate, mapped to the citation shape
// a group or comparison prints. Unsorted: callers combining more than one
// predicate sort once over the merged result.
function linkedActionsWhere(
  actions: PayMappingActionWire[],
  predicate: (action: PayMappingActionWire) => boolean,
  formatters: ReportFormatters
): ReportLinkedAction[] {
  return actions
    .filter((action) => !action.erased && predicate(action))
    .map((action) => ({
      number: action.number,
      ownerName: action.ownerName,
      plannedDate: formatters.date(action.plannedDate),
    }))
}

// The non-erased actions anchored to exactly one target, as the citation
// rows a group or comparison prints, ordered by number.
function linkedActions(
  actions: PayMappingActionWire[],
  target: PayMappingActionWire["target"],
  formatters: ReportFormatters
): ReportLinkedAction[] {
  return linkedActionsWhere(
    actions,
    (action) => targetMatches(action.target, target),
    formatters
  ).sort((a, b) => a.number - b.number)
}

// A group's priced frozen members. An equal-work-shaped group (a role title)
// matches by title + level (the engine's own identity test); a per-level
// group (null title) spans every priced row on its level.
export function memberRows(
  rows: PayMappingSnapshotRow[],
  group: { roleTitle: string | null; level: number | null }
): PayMappingSnapshotRow[] {
  return rows.filter(
    (row) =>
      row.basicMonthly !== null &&
      (group.roleTitle === null
        ? row.level === group.level
        : rowInGroup(row, group))
  )
}

// Signed gap from two per-gender figures: positive when men earn more. The
// one formula every derived gap in the report layer shares (medians here,
// the workbook's tables in the metrics module).
export function signedGapPctOf(
  women: number | null,
  men: number | null
): number | null {
  if (women === null || men === null || men === 0) return null
  return ((men - women) / men) * 100
}

// The cost roll-up of a set of action rows, per recurrence unit: a lump sum
// and a monthly figure cannot share one total, so the text enumerates the
// units that occur, in COST_UNITS order. Null when no row carries a cost.
// Reads the rows' raw parts and the formatter that produced their display
// text, so a roll-up can never print in a different format than its rows.
export function costTotalsText(
  rows: readonly Pick<ReportActionRow, "costAmount" | "costUnit">[],
  formatters: Pick<ReportFormatters, "money" | "costUnitSuffix">
): string | null {
  const byUnit: Record<CostUnit, number> = {
    oneOff: 0,
    perMonth: 0,
    perYear: 0,
  }
  let any = false
  for (const row of rows) {
    if (row.costAmount === null) continue
    any = true
    byUnit[row.costUnit ?? "oneOff"] += row.costAmount
  }
  if (!any) return null
  const parts = COST_UNITS.filter((unit) => byUnit[unit] > 0).map(
    (unit) => formatters.money(byUnit[unit]) + formatters.costUnitSuffix(unit)
  )
  return parts.join(", ") || formatters.money(0)
}

// The per-gender total-comp medians for a group, computed from the frozen
// rows through the shared engine statistics (never a second median formula).
function tccMedianText(
  members: PayMappingSnapshotRow[],
  formatters: ReportFormatters
): ReportMedianText {
  const women = genderStats(
    members.filter((row) => row.gender === "Kvinna").map(fteTotalMonthly)
  )
  const men = genderStats(
    members.filter((row) => row.gender === "Man").map(fteTotalMonthly)
  )
  const gap = signedGapPctOf(women?.median ?? null, men?.median ?? null)
  return {
    women: women === null ? null : formatters.money(women.median),
    men: men === null ? null : formatters.money(men.median),
    gapPct: gap === null ? null : formatters.pct(gap),
  }
}

// P10-P90 span of a member list's total compensation, as display text. An
// en dash range; percentiles rather than min/max so the span never prints an
// individual's exact salary.
function spreadSpan(
  members: PayMappingSnapshotRow[],
  formatters: ReportFormatters
): string | null {
  const values = members.map(fteTotalMonthly)
  const p10 = percentileOf(values, 10)
  const p90 = percentileOf(values, 90)
  if (p10 === null || p90 === null) return null
  // Breakable spaces around the dash: locale money strings join their
  // digits and unit with no-break spaces, so an unspaced range is ONE word
  // wider than its table cell, and react-pdf force-breaks an overflowing
  // word with an inserted hyphen mid-amount.
  return `${formatters.money(p10)} – ${formatters.money(p90)}`
}

function groupRow(
  group: GapGroup,
  input: {
    analysis: GroupAnalysis | undefined
    rows: PayMappingSnapshotRow[]
    previousGapPct: number | null
    // The scope the group's actions anchor under; null for the women-ahead
    // list, which takes no actions and carries no documentation duty.
    scope: "equalWork" | null
    analyses: GroupAnalysis[]
    actions: PayMappingActionWire[]
    formatters: ReportFormatters
  }
): ReportGroupRow {
  const { analysis, rows, previousGapPct, scope, analyses, actions } = input
  const { formatters } = input
  const linked =
    scope === null
      ? []
      : linkedActionsWhere(
          actions,
          (action) =>
            targetMatches(action.target, {
              kind: "group",
              scope,
              groupKey: group.key,
            }) ||
            (action.target.kind === "person" &&
              action.target.scope === scope &&
              action.target.groupKey === group.key),
          formatters
        ).sort((a, b) => a.number - b.number)
  return {
    key: group.key,
    label: groupLabel(group),
    level: group.level,
    womenCount: group.womenCount,
    menCount: group.menCount,
    masked: exportMasksGenderMeans(group),
    tcc: metricText(group.tcc, formatters),
    tccMedian: tccMedianText(memberRows(rows, group), formatters),
    base: metricText(group.base, formatters),
    flag: group.flag,
    baseDriven: group.baseDriven,
    previousGapPct:
      previousGapPct === null ? null : formatters.pct(previousGapPct),
    reasons: analysis?.reasons ?? [],
    note: analysis?.note ?? null,
    done: analysis?.done ?? false,
    status:
      scope === "equalWork"
        ? equalWorkGroupStatus(group, analyses, actions)
        : "noActionNeeded",
    actions: linked,
  }
}

function womenDominatedRow(
  group: WomenDominatedGroupWire,
  analyses: GroupAnalysis[],
  actions: PayMappingActionWire[],
  rows: PayMappingSnapshotRow[],
  formatters: ReportFormatters
): ReportWomenDominatedGroup {
  const masked = exportMasksWholeGroupMean(group.headcount)
  const own = analysisFor(analyses, "equivalentWork", group.key)
  return {
    key: group.key,
    label: groupLabel(group),
    level: group.level,
    headcount: group.headcount,
    womenSharePct: formatters.pct(group.womenSharePct),
    meanComp: formatters.money(group.meanComp),
    spread: spreadSpan(memberRows(rows, group), formatters),
    masked,
    reasons: own?.reasons ?? [],
    note: own?.note ?? null,
    done: own?.done ?? false,
    status: womenDominatedGroupStatus(group, analyses, actions),
    actions: linkedActions(
      actions,
      { kind: "group", scope: "equivalentWork", groupKey: group.key },
      formatters
    ),
    comparisons: group.comparisons.map((comparison) => {
      // The difference reads against the dominated group's own mean, so the
      // flag is set when EITHER side's whole-group mean is under the floor.
      const comparisonMasked =
        masked || exportMasksWholeGroupMean(comparison.headcount)
      const row = analysisFor(
        analyses,
        "equivalentWork",
        group.key,
        comparison.key
      )
      return {
        key: comparison.key,
        label: groupLabel(comparison),
        level: comparison.level,
        headcount: comparison.headcount,
        womenSharePct: formatters.pct(comparison.womenSharePct),
        meanComp: formatters.money(comparison.meanComp),
        spread: spreadSpan(memberRows(rows, comparison), formatters),
        diffPct:
          comparison.diffPct === null
            ? null
            : formatters.pct(comparison.diffPct),
        diffKr: formatters.money(comparison.diffSek),
        masked: comparisonMasked,
        reasons: row?.reasons ?? [],
        note: row?.note ?? null,
        status: comparisonStatus(group, comparison.key, analyses, actions),
        actions: linkedActions(
          actions,
          {
            kind: "comparison",
            groupKey: group.key,
            comparisonKey: comparison.key,
          },
          formatters
        ),
      }
    }),
  }
}

// The organization-level variable-pay figures for the key-figures workbook
// (floorVariablePayStats applies the export floor there): the share of each
// gender receiving any pay component beyond basic salary (over that gender's
// priced headcount), and the mean/median amounts among receivers. UNMASKED
// (ADR-0030): raw numbers, null only when a gender has no priced rows
// (sharePct) or no receivers among them (mean/median). The priced and
// receiver counts ride along so a surface that leaves the HR context can
// apply floorVariablePayStats without recomputing anything.
export interface OrgVariablePayStats {
  womenPriced: number
  menPriced: number
  womenReceivers: number
  menReceivers: number
  womenSharePct: number | null
  menSharePct: number | null
  womenMean: number | null
  menMean: number | null
  womenMedian: number | null
  menMedian: number | null
}

export function orgVariablePayStats(
  pricedRows: PayMappingSnapshotRow[]
): OrgVariablePayStats {
  const variable = (row: PayMappingSnapshotRow) =>
    fteTotalMonthly(row) - fteBaseMonthly(row)
  const gender = (value: "Kvinna" | "Man") =>
    pricedRows.filter((row) => row.gender === value)
  const stats = (rows: PayMappingSnapshotRow[]) => {
    const receivers = rows.map(variable).filter((value) => value > 0)
    const counts = { priced: rows.length, receivers: receivers.length }
    if (rows.length === 0) {
      return { ...counts, sharePct: null, mean: null, median: null }
    }
    const sharePct = (receivers.length / rows.length) * 100
    if (receivers.length === 0) {
      return { ...counts, sharePct, mean: null, median: null }
    }
    return {
      ...counts,
      sharePct,
      mean: receivers.reduce((sum, value) => sum + value, 0) / receivers.length,
      median: percentileOf(receivers, 50),
    }
  }
  const women = stats(gender("Kvinna"))
  const men = stats(gender("Man"))
  return {
    womenPriced: women.priced,
    menPriced: men.priced,
    womenReceivers: women.receivers,
    menReceivers: men.receivers,
    womenSharePct: women.sharePct,
    menSharePct: men.sharePct,
    womenMean: women.mean,
    menMean: men.mean,
    womenMedian: women.median,
    menMedian: men.median,
  }
}

// The most recent earlier COMPLETED run: its actions (with their live
// statuses) for the evaluation section, and its gap aggregate for the
// year-over-year figures. Null on a first-ever kartläggning. The evaluation
// NOTE is this run's own praxis row for the previousActions area.
export interface ReportPreviousInput {
  runLabel: string
  referenceDate: number
  actions: PayMappingActionWire[]
  gap: PayMappingGapResult | null
}

export function assemblePayMappingReport(input: {
  run: PayMappingRunDetail
  gap: PayMappingGapResult
  analyses: GroupAnalysis[]
  actions: PayMappingActionWire[]
  notes: PayMappingNoteWire[]
  previous: ReportPreviousInput | null
  formatters: ReportFormatters
  praxisAreaLabel: (area: PraxisAreaKey) => string
}): PayMappingReportDoc {
  const {
    run,
    gap,
    analyses,
    actions,
    notes,
    previous,
    formatters,
    praxisAreaLabel,
  } = input

  const pricedRows = run.rows.filter((row) => row.basicMonthly !== null)

  // The previous run's mean total-comp gap per group key, for the
  // year-over-year figure on rows whose group existed last time.
  const previousGapByKey = new Map<string, number | null>()
  if (previous?.gap) {
    for (const group of [
      ...previous.gap.equalWork,
      ...previous.gap.equivalentWork,
      ...previous.gap.excluded.reverse,
    ]) {
      previousGapByKey.set(group.key, group.tcc.gapPct)
    }
  }
  const previousGapFor = (key: string): number | null =>
    previousGapByKey.get(key) ?? null

  const equalWork = gap.equalWork.map((group) =>
    groupRow(group, {
      analysis: analysisFor(analyses, "equalWork", group.key),
      rows: pricedRows,
      previousGapPct: previousGapFor(group.key),
      scope: "equalWork",
      analyses,
      actions,
      formatters,
    })
  )
  // Women-ahead groups carry no documentation duty (ADR-0015) but are listed
  // with their figures so the written documentation accounts for every
  // analysed group, not only the flagged ones.
  const reverseGroups = gap.excluded.reverse.map((group) =>
    groupRow(group, {
      analysis: undefined,
      rows: pricedRows,
      previousGapPct: previousGapFor(group.key),
      scope: null,
      analyses,
      actions,
      formatters,
    })
  )
  const genderPureGroups: ReportGenderPureRow[] = gap.excluded.genderPure.map(
    (group) => ({
      key: group.key,
      label: groupLabel(group),
      level: group.level,
      gender: group.gender,
      count: group.count,
    })
  )
  const womenDominated = gap.womenDominated.map((group) =>
    womenDominatedRow(group, analyses, actions, pricedRows, formatters)
  )

  // The method section states a document-wide figure for the groups the
  // export threshold bites, so the count must cover every list whose rows
  // carry the flag: the equal-work table, the women-ahead list, the
  // women-dominated groups, and comparators flagged by their own headcount.
  // Distinct group KEYS, because the same group can render masked in more
  // than one place (an equal-work group also appears as a comparator). A
  // comparison masked only because its dominated side is masked does not add
  // a group: the dominated group is the one the rule bit.
  const maskedKeys = new Set<string>()
  for (const group of [...equalWork, ...reverseGroups]) {
    if (group.masked) maskedKeys.add(group.key)
  }
  for (const group of womenDominated) {
    if (group.masked) maskedKeys.add(group.key)
    for (const comparison of group.comparisons) {
      if (exportMasksWholeGroupMean(comparison.headcount)) {
        maskedKeys.add(comparison.key)
      }
    }
  }
  const maskedGroupCount = maskedKeys.size

  // Grouped by comparison type for the action table's scope bands (a
  // comparison target always belongs to the women-dominated chapter, a
  // praxis target to the practice review); stable within each band.
  const actionScope = (
    target: PayMappingActionWire["target"]
  ): "equalWork" | "equivalentWork" | "praxis" =>
    target.kind === "comparison"
      ? "equivalentWork"
      : target.kind === "praxis"
        ? "praxis"
        : target.scope
  const scopeRank = (scope: "equalWork" | "equivalentWork" | "praxis") =>
    scope === "equalWork" ? 0 : scope === "equivalentWork" ? 1 : 2
  const actionRows: ReportActionRow[] = [...actions]
    .sort(
      (a, b) =>
        scopeRank(actionScope(a.target)) - scopeRank(actionScope(b.target))
    )
    .map((action) => ({
      id: action.actionId,
      number: action.number,
      kind: action.target.kind,
      scope: actionScope(action.target),
      label: targetGroupLabel(action.target, praxisAreaLabel),
      problem: action.problem,
      plannedAction: action.plannedAction,
      reason: action.reason,
      ownerName: action.ownerName,
      plannedDate: formatters.date(action.plannedDate),
      plannedDateMs: action.plannedDate,
      cost:
        action.estimatedCost === null
          ? null
          : formatters.money(action.estimatedCost) +
            formatters.costUnitSuffix(action.estimatedCostUnit),
      costAmount: action.estimatedCost,
      costUnit: action.estimatedCostUnit,
      priority: action.priority,
      status: action.status,
      erased: action.erased,
    }))
  const actionTotals = {
    count: actions.length,
    cost: costTotalsText(actionRows, formatters),
    notStarted: actions.filter((a) => a.status === "notStarted").length,
    inProgress: actions.filter((a) => a.status === "inProgress").length,
    done: actions.filter((a) => a.status === "done").length,
  }
  const costForScope = (scope: ReportActionRow["scope"]) =>
    costTotalsText(
      actionRows.filter((action) => action.scope === scope),
      formatters
    )

  const noteRows: ReportNoteRow[] = notes.map((note) => ({
    id: note.noteId,
    label: targetGroupLabel(note.target, praxisAreaLabel),
    noteType: note.noteType,
    text: note.text,
    authorName: note.createdByName,
    date: formatters.date(note.createdAt),
    erased: note.erased,
  }))

  const praxis: ReportPraxisRow[] = BASE_PRAXIS_AREA_KEYS.map((key) => {
    const row = analysisFor(analyses, "praxis", key)
    const action = [...actions]
      .filter(
        (candidate) =>
          !candidate.erased &&
          candidate.target.kind === "praxis" &&
          candidate.target.area === key
      )
      .sort((a, b) => a.number - b.number)[0]
    return {
      key,
      finding: row?.finding ?? null,
      note: row?.note ?? null,
      done: row?.done ?? false,
      action:
        action === undefined
          ? null
          : {
              number: action.number,
              plannedAction: action.plannedAction,
              plannedDate: formatters.date(action.plannedDate),
            },
    }
  })

  const previousRow = analysisFor(analyses, "praxis", "previousActions")
  const previousEvaluation: ReportPreviousEvaluation | null =
    previous === null
      ? null
      : {
          runLabel: previous.runLabel,
          referenceDate: formatters.date(previous.referenceDate),
          finding: previousRow?.finding ?? null,
          note: previousRow?.note ?? null,
          actions: previous.actions.map((action) => ({
            id: action.actionId,
            number: action.number,
            label: targetGroupLabel(action.target, praxisAreaLabel),
            plannedAction: action.plannedAction,
            status: action.status,
            plannedDate: formatters.date(action.plannedDate),
            cost:
              action.estimatedCost === null
                ? null
                : formatters.money(action.estimatedCost) +
                  formatters.costUnitSuffix(action.estimatedCostUnit),
            erased: action.erased,
          })),
        }

  const totalWeight = run.frozenMethod.criteria.reduce(
    (sum, criterion) => sum + criterion.weightPoints,
    0
  )

  // The method note's conversion-factor line: how many priced rows were paid
  // hourly, and how many of those carried their own hours rather than the
  // run's full-time default.
  const hourlyRows = pricedRows.filter(isHourlyRow)
  const ownHoursCount = hourlyRows.filter(
    (row) =>
      row.hoursPerMonth !== undefined &&
      row.hoursPerMonth !== run.fullTimeHoursDefault
  ).length

  // Org-level medians over the priced population's total compensation (the
  // same measure the org mean uses); population-level like the mean, so
  // never masked, but a gender with no priced rows has no median.
  const orgWomenValues = pricedRows
    .filter((row) => row.gender === "Kvinna")
    .map(fteTotalMonthly)
  const orgMenValues = pricedRows
    .filter((row) => row.gender === "Man")
    .map(fteTotalMonthly)
  // Org-level medians over the priced population's total compensation,
  // unmasked like everything else here; the signing projection applies the
  // per-gender floor. They feed the summary's two share figures only.
  const orgWomenMedian = percentileOf(orgWomenValues, 50)
  const orgMenMedian = percentileOf(orgMenValues, 50)

  const shareOfMenPct = (
    women: number | null,
    men: number | null
  ): string | null =>
    women === null || men === null || men === 0
      ? null
      : formatters.pct((women / men) * 100)

  const sharePct = (points: number): string =>
    totalWeight === 0
      ? formatters.pct(0)
      : formatters.pct((points / totalWeight) * 100)
  const dimensionOrder: string[] = []
  const pointsByDimension = new Map<string, number>()
  for (const criterion of run.frozenMethod.criteria) {
    if (criterion.dimensionKey === null) continue
    if (!pointsByDimension.has(criterion.dimensionKey)) {
      dimensionOrder.push(criterion.dimensionKey)
      pointsByDimension.set(criterion.dimensionKey, 0)
    }
    pointsByDimension.set(
      criterion.dimensionKey,
      (pointsByDimension.get(criterion.dimensionKey) ?? 0) +
        criterion.weightPoints
    )
  }

  return {
    status: run.status === "completed" ? "final" : "draft",
    runLabel: run.label,
    referenceDate: formatters.date(run.referenceDate),
    currency: gap.currency,
    population: {
      total: run.populationCount,
      women: gap.population.women,
      men: gap.population.men,
      priced: pricedRows.length,
      womenPriced: orgWomenValues.length,
      menPriced: orgMenValues.length,
    },
    identity: {
      systemVersion: run.systemVersion,
      approvedAt:
        run.frozenMethod.approvedAt === null
          ? null
          : formatters.date(run.frozenMethod.approvedAt),
      referenceDate: formatters.date(run.referenceDate),
      extractedAt: formatters.dateTime(run.referenceDate),
    },
    quartiles: gap.quartiles,
    // Projected explicitly, formatting the samverkan date (null when the
    // run has none).
    collaboration:
      run.collaboration === null
        ? null
        : {
            participants: run.collaboration.participants,
            description: run.collaboration.description,
            date:
              run.collaboration.date === null
                ? null
                : formatters.date(run.collaboration.date),
            remarks: run.collaboration.remarks?.trim() || null,
          },
    praxis,
    equalWork,
    reverseGroups,
    genderPureGroups,
    womenDominated,
    actions: actionRows,
    summary: {
      womenShareOfMenMeanPct: shareOfMenPct(
        gap.org.womenMeanComp,
        gap.org.menMeanComp
      ),
      womenShareOfMenMedianPct: shareOfMenPct(orgWomenMedian, orgMenMedian),
    },
    actionTotals,
    actionCostByScope: {
      equalWork: costForScope("equalWork"),
      equivalentWork: costForScope("equivalentWork"),
      praxis: costForScope("praxis"),
    },
    notes: noteRows,
    previousEvaluation,
    fullTimeHoursDefault: run.fullTimeHoursDefault,
    method: {
      criteria: run.frozenMethod.criteria.map((criterion) => ({
        name: criterion.name,
        dimensionKey: criterion.dimensionKey,
        weightPoints: criterion.weightPoints,
        sharePct: sharePct(criterion.weightPoints),
        purpose: criterion.purpose,
        whyRelevant: criterion.whyRelevant,
        weightMotivation: criterion.weightMotivation,
      })),
      dimensionShares: dimensionOrder.map((dimensionKey) => ({
        dimensionKey,
        sharePct: sharePct(pointsByDimension.get(dimensionKey) ?? 0),
      })),
      pointBudget: totalWeight,
      levelRules: run.frozenMethod.levelRules,
      zoneProfileRules: run.frozenMethod.zoneProfileRules,
      workingConditions: run.frozenMethod.workingConditions,
      approvedAt:
        run.frozenMethod.approvedAt === null
          ? null
          : formatters.date(run.frozenMethod.approvedAt),
      maskedGroupCount,
      singletonCount: gap.excluded.singletonCount,
      genderPureCount: gap.excluded.genderPure.length,
      reverseCount: gap.excluded.reverse.length,
      hourlyRowCount: hourlyRows.length,
      ownHoursCount,
    },
  }
}

// The method section's hourly-conversion note: null when the run has no
// hourly rows (nothing to explain), otherwise the sentence naming the run's
// full-time hours default and how many hourly rows carried their own value.
// Pure so the gating condition (hourlyRowCount, not ownHoursCount) and the
// argument mapping (hours <- fullTimeHoursDefault, count <- ownHoursCount)
// are pinned once and shared by every renderer (the export hook, and any
// future consumer) instead of re-derived inline.
export function hourlyNoteLabel(
  doc: Pick<PayMappingReportDoc, "fullTimeHoursDefault" | "method">,
  t: ReturnType<typeof useTranslations<"dashboard.payMapping.report">>
): string | null {
  if (doc.method.hourlyRowCount === 0) return null
  return t("hourlyNote", {
    hours: doc.fullTimeHoursDefault,
    count: doc.method.ownHoursCount,
  })
}
