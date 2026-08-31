// Assembly of the statutory lönekartläggning report document (M8): a pure
// mapping from the run's frozen data + work layer to the typed doc the PDF
// template renders. Everything display-formatted is formatted HERE through
// injected formatters (locale-aware money/percent/date), so the template
// stays layout-only and this step is unit-testable with identity formatters.
// Engine-agnostic by design (ADR-0026): nothing in this module knows which
// PDF engine renders the doc.
//
// This module is also the ADR-0012 EXPORT BOUNDARY for small-cell masking:
// in-app views show every group's figures (HR already sees each salary), but
// a value leaving the HR context is masked below the small-cell minimums.
// The rule lives here, not in the engine (go-live checklist: "P1 small-cell
// masking at the export boundary").
import type { PayGapReason, PraxisAreaKey } from "@workspace/constants"
import { BASE_PRAXIS_AREA_KEYS } from "@workspace/constants"
import type { PayGapFlag } from "@workspace/core"
import { genderStats, percentileOf } from "@workspace/core"
import type {
  ActionPriority,
  ActionStatus,
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
  fteBaseMonthly,
  fteTotalMonthly,
  groupLabel,
  rowInGroup,
  targetGroupLabel,
} from "./pay-mapping-gap-types"

// The export-boundary small-cell minimums (ADR-0012, tillägg 2026-07-16): a
// PER-GENDER group mean/gap leaves the HR context only when the group has at
// least this many people in total AND at least this many per gender. A
// whole-group mean (the women-dominated comparison ranks whole groups, not
// genders) has no per-gender leg; it masks below the total minimum alone,
// because a small group's mean approaches an individual's salary. The rule
// is this product's own conservative disclosure choice: no Swedish statute,
// DO guidance, or social-partner material prescribes a numeric threshold,
// and real employer documents commonly list every group unmasked. Never
// present it as an industry standard.
export const EXPORT_MIN_GROUP_SIZE = 4
export const EXPORT_MIN_PER_GENDER = 2

export function exportMasksGenderMeans(group: {
  womenCount: number
  menCount: number
}): boolean {
  return (
    group.womenCount + group.menCount < EXPORT_MIN_GROUP_SIZE ||
    group.womenCount < EXPORT_MIN_PER_GENDER ||
    group.menCount < EXPORT_MIN_PER_GENDER
  )
}

export function exportMasksWholeGroupMean(headcount: number): boolean {
  return headcount < EXPORT_MIN_GROUP_SIZE
}

// Locale-aware display formatting, injected so the assembly stays pure. pct
// takes a 0-100 figure (the wire's unit) and renders unsigned; signedPct
// keeps the sign (the per-level table is bidirectional, so an unsigned
// figure would render a level where women are ahead identically to one
// where they are behind); money renders in the run's currency; date takes
// epoch ms.
export interface ReportFormatters {
  money: (value: number) => string
  pct: (value: number) => string
  signedPct: (value: number) => string
  date: (epochMs: number) => string
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
// published municipal documents). Masked together with the row's means.
export interface ReportMedianText {
  women: string | null
  men: string | null
  gapPct: string | null
}

export interface ReportGroupRow {
  key: string
  label: string
  level: number | null
  womenCount: number
  menCount: number
  // Export-boundary masking applied to this row's means/gaps.
  masked: boolean
  base: ReportMetricText
  baseMedian: ReportMedianText
  tcc: ReportMetricText
  flag: PayGapFlag
  tccDriven: boolean
  // The same group's mean base-salary gap in the PREVIOUS completed
  // kartläggning, when that run had the group (year-over-year figures in the
  // tables, the near-universal convention in published documents).
  previousGapPct: string | null
  reasons: PayGapReason[]
  note: string | null
  done: boolean
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
  kind: "group" | "person" | "comparison"
  // Which statutory comparison the measure belongs to: the action table
  // groups by it (a comparison target always belongs to the women-dominated
  // chapter).
  scope: "equalWork" | "equivalentWork"
  label: string
  problem: string
  plannedAction: string
  reason: PayGapReason | null
  ownerName: string
  plannedDate: string
  cost: string | null
  priority: ActionPriority
  status: ActionStatus
}

export interface ReportNoteRow {
  id: string
  label: string
  noteType: NoteType
  text: string
  authorName: string
  date: string
}

export interface ReportPraxisRow {
  key: PraxisAreaKey
  finding: "none" | "found" | null
  note: string | null
  done: boolean
}

export interface ReportPreviousEvaluation {
  runLabel: string
  referenceDate: string
  finding: "none" | "found" | null
  note: string | null
  actions: {
    id: string
    label: string
    plannedAction: string
    status: ActionStatus
    plannedDate: string
    cost: string | null
  }[]
}

// One gender's population-level pay distribution (FTE-adjusted total
// compensation): the five-point spread published pay statistics use.
export interface ReportSpreadRow {
  p10: string
  q1: string
  median: string
  q3: string
  p90: string
}

// The same five points as raw numbers, for the charts (the tables render
// the formatted twin above; both derive from ONE computation).
export interface ReportSpreadNums {
  p10: number
  q1: number
  median: number
  q3: number
  p90: number
}

export interface PayMappingReportDoc {
  status: "draft" | "final"
  runLabel: string
  referenceDate: string
  currency: string | null
  population: { total: number; women: number; men: number; priced: number }
  // The org-level MEANS stay unmasked at every boundary (a population mean
  // over the whole workforce is not a small cell, gap.ts's own rule); the
  // MEDIANS follow the population-spread floor and null for a gender with
  // fewer than EXPORT_MIN_GROUP_SIZE priced rows.
  org: {
    gapPct: string | null
    flag: PayGapFlag
    womenMean: string | null
    menMean: string | null
    womenMedian: string | null
    menMedian: string | null
    medianGapPct: string | null
  }
  // The previous completed kartläggning's org-level figure, for the intro's
  // year-over-year line.
  orgPrevious: {
    runLabel: string
    referenceDate: string
    gapPct: string
  } | null
  quartiles: { women: number; men: number }[]
  // Population-level spread per gender; a gender masks below the whole-group
  // minimum (its percentiles approach individual salaries).
  spread: { women: ReportSpreadRow | null; men: ReportSpreadRow | null }
  // Raw numbers for the charts, mirroring the formatted fields above: the
  // org means and the spread points. Null exactly when the formatted twin
  // is null, so a chart can never show what a table masks.
  chartData: {
    means: { women: number; men: number } | null
    spread: {
      women: ReportSpreadNums | null
      men: ReportSpreadNums | null
    }
  }
  collaboration: { participants: string; description: string } | null
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
  equivalentWorkLevels: ReportGroupRow[]
  womenDominated: ReportWomenDominatedGroup[]
  actions: ReportActionRow[]
  // The key-figures the summary page tabulates, all derived from the same
  // aggregates the sections render.
  summary: {
    // Women's mean/median pay as a percent of men's (the professional
    // template convention; 100 = parity). Median follows the spread floor.
    womenShareOfMenMeanPct: string | null
    womenShareOfMenMedianPct: string | null
    equalWorkGroups: number
    equalWorkRequired: number
    equalWorkDocumented: number
    womenDominatedGroups: number
    comparisonCount: number
    comparisonsDocumented: number
  }
  actionTotals: {
    count: number
    cost: string | null
    notStarted: number
    inProgress: number
    done: number
  }
  notes: ReportNoteRow[]
  previousEvaluation: ReportPreviousEvaluation | null
  method: {
    criteria: { name: string; weightPoints: number; sharePct: string }[]
    pointBudget: number
    maskedGroupCount: number
    singletonCount: number
    genderPureCount: number
    reverseCount: number
  }
}

// `signed` is the per-level table's mode: that table lists every level in
// BOTH directions (the wire builds it unconditionally, unlike equal work,
// which routes women-ahead groups to their own labelled list), so only a
// signed figure can say which gender is ahead. Everywhere else the figures
// stay unsigned: direction is carried by the section and the status word,
// never by a lone minus sign that its section does not explain.
function metricText(
  metric: GapMetric,
  masked: boolean,
  formatters: ReportFormatters,
  signed = false
): ReportMetricText {
  if (masked) {
    return { womenMean: null, menMean: null, gapPct: null, gapKr: null }
  }
  const pct = signed ? formatters.signedPct : formatters.pct
  return {
    womenMean:
      metric.womenMean === null ? null : formatters.money(metric.womenMean),
    menMean: metric.menMean === null ? null : formatters.money(metric.menMean),
    gapPct: metric.gapPct === null ? null : pct(metric.gapPct),
    gapKr:
      metric.gapKr === null
        ? null
        : formatters.money(signed ? metric.gapKr : Math.abs(metric.gapKr)),
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

// A group's priced frozen members. An equal-work-shaped group (a role title)
// matches by title + level (the engine's own identity test); a per-level
// group (null title) spans every priced row on its level.
function memberRows(
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

function medianGapPct(women: number | null, men: number | null): number | null {
  if (women === null || men === null || men === 0) return null
  return ((men - women) / men) * 100
}

// The per-gender base-salary medians for a group, computed from the frozen
// rows through the shared engine statistics (never a second median formula).
function baseMedianText(
  members: PayMappingSnapshotRow[],
  masked: boolean,
  formatters: ReportFormatters,
  signed = false
): ReportMedianText {
  if (masked) return { women: null, men: null, gapPct: null }
  const women = genderStats(
    members.filter((row) => row.gender === "Kvinna").map(fteBaseMonthly)
  )
  const men = genderStats(
    members.filter((row) => row.gender === "Man").map(fteBaseMonthly)
  )
  const gap = medianGapPct(women?.median ?? null, men?.median ?? null)
  return {
    women: women === null ? null : formatters.money(women.median),
    men: men === null ? null : formatters.money(men.median),
    gapPct:
      gap === null
        ? null
        : (signed ? formatters.signedPct : formatters.pct)(gap),
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
  analysis: GroupAnalysis | undefined,
  rows: PayMappingSnapshotRow[],
  previousGapPct: number | null,
  formatters: ReportFormatters,
  signed = false
): ReportGroupRow {
  const masked = exportMasksGenderMeans(group)
  const pct = signed ? formatters.signedPct : formatters.pct
  return {
    key: group.key,
    label: groupLabel(group),
    level: group.level,
    womenCount: group.womenCount,
    menCount: group.menCount,
    masked,
    base: metricText(group.base, masked, formatters, signed),
    baseMedian: baseMedianText(
      memberRows(rows, group),
      masked,
      formatters,
      signed
    ),
    tcc: metricText(group.tcc, masked, formatters, signed),
    flag: group.flag,
    tccDriven: group.tccDriven,
    previousGapPct:
      masked || previousGapPct === null ? null : pct(previousGapPct),
    reasons: analysis?.reasons ?? [],
    note: analysis?.note ?? null,
    done: analysis?.done ?? false,
  }
}

function womenDominatedRow(
  group: WomenDominatedGroupWire,
  analyses: GroupAnalysis[],
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
    meanComp: masked ? null : formatters.money(group.meanComp),
    spread: masked ? null : spreadSpan(memberRows(rows, group), formatters),
    masked,
    reasons: own?.reasons ?? [],
    note: own?.note ?? null,
    done: own?.done ?? false,
    comparisons: group.comparisons.map((comparison) => {
      // The difference reads against the dominated group's own mean, so it
      // masks when EITHER side's whole-group mean is masked.
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
        meanComp: comparisonMasked
          ? null
          : formatters.money(comparison.meanComp),
        spread: comparisonMasked
          ? null
          : spreadSpan(memberRows(rows, comparison), formatters),
        diffPct:
          comparisonMasked || comparison.diffPct === null
            ? null
            : formatters.pct(comparison.diffPct),
        diffKr: comparisonMasked ? null : formatters.money(comparison.diffSek),
        masked: comparisonMasked,
        reasons: row?.reasons ?? [],
        note: row?.note ?? null,
      }
    }),
  }
}

// One gender's population five-point spread as raw numbers, or null when
// that gender's priced count sits under the whole-group minimum (its
// percentiles approach individual salaries).
function populationSpreadNums(values: number[]): ReportSpreadNums | null {
  if (values.length < EXPORT_MIN_GROUP_SIZE) return null
  const p10 = percentileOf(values, 10)
  const q1 = percentileOf(values, 25)
  const median = percentileOf(values, 50)
  const q3 = percentileOf(values, 75)
  const p90 = percentileOf(values, 90)
  if (
    p10 === null ||
    q1 === null ||
    median === null ||
    q3 === null ||
    p90 === null
  ) {
    return null
  }
  return { p10, q1, median, q3, p90 }
}

function spreadText(
  nums: ReportSpreadNums | null,
  formatters: ReportFormatters
): ReportSpreadRow | null {
  if (nums === null) return null
  return {
    p10: formatters.money(nums.p10),
    q1: formatters.money(nums.q1),
    median: formatters.money(nums.median),
    q3: formatters.money(nums.q3),
    p90: formatters.money(nums.p90),
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
}): PayMappingReportDoc {
  const { run, gap, analyses, actions, notes, previous, formatters } = input

  const pricedRows = run.rows.filter((row) => row.basicMonthly !== null)

  // The previous run's mean base-salary gap per group key, for the
  // year-over-year figure on rows whose group existed last time. The wire
  // value is never export-masked, so the export rule is applied HERE on the
  // PREVIOUS group's own counts: a gap computed from a below-minimum group
  // must not leak into a later year's document just because the group has
  // since grown.
  const previousGapByKey = new Map<string, number | null>()
  if (previous?.gap) {
    for (const group of [
      ...previous.gap.equalWork,
      ...previous.gap.equivalentWork,
      ...previous.gap.excluded.reverse,
    ]) {
      previousGapByKey.set(
        group.key,
        exportMasksGenderMeans(group) ? null : group.base.gapPct
      )
    }
  }
  const previousGapFor = (key: string): number | null =>
    previousGapByKey.get(key) ?? null

  const equalWork = gap.equalWork.map((group) =>
    groupRow(
      group,
      analysisFor(analyses, "equalWork", group.key),
      pricedRows,
      previousGapFor(group.key),
      formatters
    )
  )
  // Women-ahead groups carry no documentation duty (ADR-0015) but are listed
  // with their figures so the written documentation accounts for every
  // analysed group, not only the flagged ones.
  const reverseGroups = gap.excluded.reverse.map((group) =>
    groupRow(
      group,
      undefined,
      pricedRows,
      previousGapFor(group.key),
      formatters
    )
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
  // The per-level likvärdigt table is context (every level, both
  // directions); it carries no documentation rows of its own, and BECAUSE it
  // runs in both directions its figures render signed (see metricText).
  const equivalentWorkLevels = gap.equivalentWork.map((group) =>
    groupRow(
      group,
      undefined,
      pricedRows,
      previousGapFor(group.key),
      formatters,
      true
    )
  )
  const womenDominated = gap.womenDominated.map((group) =>
    womenDominatedRow(group, analyses, pricedRows, formatters)
  )

  // The method section states a document-wide masked-group figure, so the
  // count must cover every list that renders masked values: the equal-work
  // table, the women-ahead list, the per-level table, the women-dominated
  // groups, and comparators masked by their own headcount. Distinct group
  // KEYS, because the same group can render masked in more than one place
  // (an equal-work group also appears as a comparator); level keys are bare
  // numbers and cannot collide with "title|level" keys. A comparison masked
  // only because its dominated side is masked does not add a group: the
  // dominated group is the one the rule bit.
  const maskedKeys = new Set<string>()
  for (const group of [
    ...equalWork,
    ...reverseGroups,
    ...equivalentWorkLevels,
  ]) {
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
  // comparison target always belongs to the women-dominated chapter);
  // stable within each band.
  const actionScope = (
    target: PayMappingActionWire["target"]
  ): "equalWork" | "equivalentWork" =>
    target.kind === "comparison" ? "equivalentWork" : target.scope
  const actionRows: ReportActionRow[] = [...actions]
    .sort(
      (a, b) =>
        (actionScope(a.target) === "equivalentWork" ? 1 : 0) -
        (actionScope(b.target) === "equivalentWork" ? 1 : 0)
    )
    .map((action) => ({
      id: action.actionId,
      kind: action.target.kind,
      scope: actionScope(action.target),
      label: targetGroupLabel(action.target),
      problem: action.problem,
      plannedAction: action.plannedAction,
      reason: action.reason,
      ownerName: action.ownerName,
      plannedDate: formatters.date(action.plannedDate),
      cost:
        action.estimatedCost === null
          ? null
          : formatters.money(action.estimatedCost),
      priority: action.priority,
      status: action.status,
    }))
  const costTotal = actions.reduce(
    (sum, action) => sum + (action.estimatedCost ?? 0),
    0
  )
  const actionTotals = {
    count: actions.length,
    cost: actions.some((action) => action.estimatedCost !== null)
      ? formatters.money(costTotal)
      : null,
    notStarted: actions.filter((a) => a.status === "notStarted").length,
    inProgress: actions.filter((a) => a.status === "inProgress").length,
    done: actions.filter((a) => a.status === "done").length,
  }

  const noteRows: ReportNoteRow[] = notes.map((note) => ({
    id: note.noteId,
    label: targetGroupLabel(note.target),
    noteType: note.noteType,
    text: note.text,
    authorName: note.createdByName,
    date: formatters.date(note.createdAt),
  }))

  const praxis: ReportPraxisRow[] = BASE_PRAXIS_AREA_KEYS.map((key) => {
    const row = analysisFor(analyses, "praxis", key)
    return {
      key,
      finding: row?.finding ?? null,
      note: row?.note ?? null,
      done: row?.done ?? false,
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
            label: targetGroupLabel(action.target),
            plannedAction: action.plannedAction,
            status: action.status,
            plannedDate: formatters.date(action.plannedDate),
            cost:
              action.estimatedCost === null
                ? null
                : formatters.money(action.estimatedCost),
          })),
        }

  const totalWeight = run.frozenCriteria.reduce(
    (sum, criterion) => sum + criterion.weightPoints,
    0
  )

  // Org-level medians over the priced population's total compensation (the
  // same measure the org mean uses); population-level like the mean, so
  // never masked, but a gender with no priced rows has no median.
  const orgWomenValues = pricedRows
    .filter((row) => row.gender === "Kvinna")
    .map(fteTotalMonthly)
  const orgMenValues = pricedRows
    .filter((row) => row.gender === "Man")
    .map(fteTotalMonthly)
  const womenSpreadNums = populationSpreadNums(orgWomenValues)
  const menSpreadNums = populationSpreadNums(orgMenValues)
  // The org medians derive from the SAME masked spread points the intro's
  // spread table shows, so the median can never print unmasked in the prose
  // line while the table beside it dashes it. The org MEANS stay unmasked
  // (documented population-level policy); the medians follow the spread
  // floor because a small gender's median is closer to an individual salary.
  const orgWomenMedian = womenSpreadNums?.median ?? null
  const orgMenMedian = menSpreadNums?.median ?? null
  const orgMedianGap = medianGapPct(orgWomenMedian, orgMenMedian)

  const orgPrevious =
    previous !== null &&
    previous.gap !== null &&
    previous.gap.org.gapPct !== null
      ? {
          runLabel: previous.runLabel,
          referenceDate: formatters.date(previous.referenceDate),
          gapPct: formatters.pct(previous.gap.org.gapPct),
        }
      : null

  const shareOfMenPct = (
    women: number | null,
    men: number | null
  ): string | null =>
    women === null || men === null || men === 0
      ? null
      : formatters.pct((women / men) * 100)
  const comparisonRows = womenDominated.flatMap((group) => group.comparisons)

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
    },
    org: {
      gapPct: gap.org.gapPct === null ? null : formatters.pct(gap.org.gapPct),
      flag: gap.org.flag,
      womenMean:
        gap.org.womenMeanComp === null
          ? null
          : formatters.money(gap.org.womenMeanComp),
      menMean:
        gap.org.menMeanComp === null
          ? null
          : formatters.money(gap.org.menMeanComp),
      womenMedian:
        orgWomenMedian === null ? null : formatters.money(orgWomenMedian),
      menMedian: orgMenMedian === null ? null : formatters.money(orgMenMedian),
      medianGapPct: orgMedianGap === null ? null : formatters.pct(orgMedianGap),
    },
    orgPrevious,
    quartiles: gap.quartiles,
    spread: {
      women: spreadText(womenSpreadNums, formatters),
      men: spreadText(menSpreadNums, formatters),
    },
    chartData: {
      means:
        gap.org.womenMeanComp !== null && gap.org.menMeanComp !== null
          ? { women: gap.org.womenMeanComp, men: gap.org.menMeanComp }
          : null,
      spread: { women: womenSpreadNums, men: menSpreadNums },
    },
    collaboration: run.collaboration,
    praxis,
    equalWork,
    reverseGroups,
    genderPureGroups,
    equivalentWorkLevels,
    womenDominated,
    actions: actionRows,
    summary: {
      womenShareOfMenMeanPct: shareOfMenPct(
        gap.org.womenMeanComp,
        gap.org.menMeanComp
      ),
      womenShareOfMenMedianPct: shareOfMenPct(orgWomenMedian, orgMenMedian),
      equalWorkGroups: equalWork.length,
      equalWorkRequired: equalWork.filter(
        (row) => row.flag === "critical" || row.flag === "elevated"
      ).length,
      equalWorkDocumented: equalWork.filter((row) => row.done).length,
      womenDominatedGroups: womenDominated.length,
      comparisonCount: comparisonRows.length,
      comparisonsDocumented: comparisonRows.filter(
        (row) => row.reasons.length > 0 || row.note !== null
      ).length,
    },
    actionTotals,
    notes: noteRows,
    previousEvaluation,
    method: {
      criteria: run.frozenCriteria.map((criterion) => ({
        name: criterion.name,
        weightPoints: criterion.weightPoints,
        sharePct:
          totalWeight === 0
            ? formatters.pct(0)
            : formatters.pct((criterion.weightPoints / totalWeight) * 100),
      })),
      pointBudget: totalWeight,
      maskedGroupCount,
      singletonCount: gap.excluded.singletonCount,
      genderPureCount: gap.excluded.genderPure.length,
      reverseCount: gap.excluded.reverse.length,
    },
  }
}

// The continuation-header derivation for the multi-pass render: given where
// every table row landed (captured by the template's onRowPage), the rows
// that START a new page within their table get their table's header
// re-rendered above them. Pure over (doc, rowPages) so the download loop
// can iterate to a fixed point and tests can pin the derivation.
export function computeHeaderBreaks(
  doc: PayMappingReportDoc,
  rowPages: Record<string, number>
): Set<string> {
  const breaks = new Set<string>()
  const tables: string[][] = [
    doc.equalWork.map((row) => `equalWork:${row.key}`),
    doc.reverseGroups.map((row) => `reverse:${row.key}`),
    doc.equivalentWorkLevels.map((row) => `levels:${row.key}`),
    ...doc.womenDominated.map((group) =>
      group.comparisons.map((comparison) => `wd:${group.key}:${comparison.key}`)
    ),
    doc.actions.map((action) => `actions:${action.id}`),
    doc.previousEvaluation?.actions.map(
      (action) => `prevActions:${action.id}`
    ) ?? [],
  ]
  for (const ids of tables) {
    let previousPage: number | undefined
    for (const id of ids) {
      const page = rowPages[id]
      if (page === undefined) continue
      if (previousPage !== undefined && page > previousPage) breaks.add(id)
      previousPage = page
    }
  }
  return breaks
}
