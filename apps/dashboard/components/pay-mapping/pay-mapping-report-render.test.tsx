import { pdf } from "@react-pdf/renderer"
import { describe, expect, it } from "vitest"
import {
  makeGapGroup,
  makeGapResult,
  makeRunDetail,
} from "@/test/pay-mapping-fixtures"
import type { PayMappingActionWire } from "./pay-mapping-gap-types"
import { assemblePayMappingReport } from "./pay-mapping-report-data"
import {
  PayMappingReportPdf,
  type PayMappingReportLabels,
} from "./pay-mapping-report-doc"

// Real render test, mirroring method-appendix-render.test.tsx: the real
// engine catches layout crashes in the node/jsdom path, and the page-ref
// capture asserts the two-pass contents plumbing. Browser-build-only faults
// and silent layout defects still need e2e rasterization (go-live checklist).

// Eight priced people (4 women, 4 men) so the population spread and its
// chart render through the real engine (below 4 per gender they mask).
const ROWS = Array.from({ length: 8 }, (_, index) => ({
  personPublicId: `p${index}`,
  displayName: `Person ${index}`,
  erased: false,
  gender: (index < 4 ? "Kvinna" : "Man") as "Kvinna" | "Man",
  roleTitle: "SWE",
  trackKey: "ic",
  seniority: "Senior",
  level: 3,
  basicMonthly: 40000 + index * 2000,
  components: [],
}))

// A builder rather than one const: the pagination regression renders the
// same document again with an action's free text grown past a page.
function buildDoc(problemText = "Unexplained gap") {
  return assemblePayMappingReport({
    run: makeRunDetail({
      status: "completed",
      collaboration: { participants: "Union rep", description: "Monthly sync" },
      frozenCriteria: [
        { name: "Knowledge", weightPoints: 4 },
        { name: "Responsibility", weightPoints: 2 },
      ],
      rows: ROWS,
    }),
    gap: makeGapResult({
      equalWork: [
        makeGapGroup(),
        makeGapGroup({ key: "QA|4", roleTitle: "QA", level: 4, flag: "ok" }),
      ],
      equivalentWork: [
        makeGapGroup({ key: "3", roleTitle: null, level: 3, flag: "ok" }),
      ],
      womenDominated: [
        {
          key: "Nurse|2",
          roleTitle: "Nurse",
          seniority: null,
          level: 2,
          headcount: 5,
          womenSharePct: 80,
          meanComp: 40000,
          comparisons: [
            {
              key: "Support|3",
              roleTitle: "Support",
              seniority: null,
              level: 3,
              headcount: 4,
              womenSharePct: 25,
              meanComp: 45000,
              diffPct: 12.5,
              diffSek: 5000,
            },
          ],
        },
      ],
      quartiles: [
        { women: 2, men: 0 },
        { women: 1, men: 1 },
        { women: 0, men: 1 },
        { women: 0, men: 2 },
      ],
    }),
    analyses: [
      {
        scope: "equalWork",
        groupKey: "SWE|3|Senior",
        comparisonKey: null,
        reasons: ["experience"],
        note: "Documented",
        done: true,
        finding: null,
      },
    ],
    actions: [
      {
        actionId: "a1" as PayMappingActionWire["actionId"],
        target: { kind: "group", scope: "equalWork", groupKey: "SWE|3" },
        problem: problemText,
        plannedAction: "Salary review",
        reason: "experience",
        ownerUserId: "u1",
        ownerName: "HR Person",
        plannedDate: 1_700_000_000_000,
        estimatedCost: 42000,
        priority: "high",
        status: "notStarted",
        createdAt: 1,
      },
    ],
    notes: [],
    previous: {
      runLabel: "Pay mapping 2025",
      referenceDate: 1_680_000_000_000,
      actions: [],
      gap: makeGapResult({
        equalWork: [makeGapGroup({ metric: { gapPct: 12, gapKr: 12000 } })],
      }),
    },
    formatters: {
      money: (value) => `${Math.round(value)} kr`,
      pct: (value) => `${value}%`,
      signedPct: (value) => `${value > 0 ? "+" : ""}${value}%`,
      date: (epochMs) => new Date(epochMs).toISOString().slice(0, 10),
    },
  })
}

const DOC = buildDoc()

const LABELS: PayMappingReportLabels = {
  docTitle: "Pay mapping documentation",
  footer: "Pay mapping documentation",
  contentsTitle: "Contents",
  statusTag: "FINAL",
  generatedOn: "Generated 31 Aug 2026",
  referenceDateLine: "Reference date 1 Jul 2026",
  populationTotal: "6",
  populationWomen: "3 (50%)",
  populationMen: "3 (50%)",
  populationPriced: "6",
  summaryTitle: "Summary",
  summaryEmployees: "Employees",
  summaryWomen: "of whom women",
  summaryMen: "of whom men",
  summaryPriced: "with a recorded salary",
  summaryWomenShareMean: "Women's average pay as a share of men's",
  summaryWomenShareMedian: "Women's median pay as a share of men's",
  summaryVariableShareWomen: "Share of women with variable pay",
  summaryVariableShareMen: "Share of men with variable pay",
  summaryVariableWomenShareMean: "Women's variable pay share of men's (mean)",
  summaryVariableWomenShareMedian:
    "Women's variable pay share of men's (median)",
  summaryGroupsShown: "Groups in the within-group comparison",
  summaryGroupsRequired: "of which require documented reasons",
  summaryGroupsDocumented: "of which marked complete",
  summarySingletons: "Single-person groups",
  summaryWdGroups: "Women-dominated groups",
  summaryComparisons: "comparisons against higher-paid groups",
  summaryComparisonsDocumented: "of which documented",
  summaryActionsCount: "Measures",
  summaryCost: "Estimated cost",
  introTitle: "Introduction",
  introBody: "The written documentation of the annual pay mapping.",
  orgGapLine: "Women average 90000, men 100000, a 10% difference.",
  orgMedianLine: "Median 90000 vs 100000, a 10% difference.",
  orgPreviousLine: "Previous mapping showed 12%.",
  chartMeansCaption: "Average total compensation per gender.",
  chartSpreadCaption: "Pay spread per gender.",
  chartQuartilesCaption: "Headcount per pay quartile.",
  quartilesTitle: "Distribution per pay quartile",
  quartileRow: (index) => `Quartile ${index + 1}`,
  spreadTitle: "Pay spread per gender",
  colP10: "P10",
  colQ1: "Q1",
  colMedian: "Median",
  colQ3: "Q3",
  colP90: "P90",
  colWomen: "Women",
  colMen: "Men",
  collaborationTitle: "Collaboration",
  participantsLabel: "Who takes part?",
  descriptionLabel: "How does it happen?",
  notDocumented: "Not yet documented.",
  praxisTitle: "Pay provisions and practices",
  praxisIntro: "Review of provisions and practices.",
  praxisAreaTitle: (key) => `Area ${key}`,
  findingLabel: (finding) =>
    finding === "none"
      ? "No deficiency"
      : finding === "found"
        ? "Deficiency found"
        : "Not reviewed",
  equalWorkTitle: "Equal work",
  equalWorkIntro: "Groups by duties; every difference analysed.",
  equalWorkStatusLine: "2 groups; 1 requires reasons; 1 complete.",
  wdStatusLine: "1 women-dominated group, 1 comparison.",
  colGroup: "Group",
  colLevel: "Level",
  colWomenMean: "Avg women",
  colMenMean: "Avg men",
  colGapPct: "Gap %",
  colGapKr: "Gap",
  colStatus: "Status",
  flagLabel: (flag) => flag,
  levelText: (level) => (level === null ? "-" : String(level)),
  levelRowLabel: (level) => (level === null ? "-" : `Level ${level}`),
  tccDrivenMarker: "†",
  tccLine: (metric) =>
    `Total comp: ${metric.womenMean ?? "-"} / ${metric.menMean ?? "-"} (${metric.gapPct ?? "-"})`,
  medianShort: "md",
  prevYearLine: (gapPct) => `Previous year: ${gapPct}.`,
  reasonsLabel: "Objective reasons",
  noteLabel: "Note",
  reasonLabel: (reason) => reason,
  undocumented: "Not documented yet.",
  emptyEqualWork: "No groups.",
  reverseTitle: "Groups where women are ahead",
  genderPureTitle: "Single-gender groups",
  genderPureRow: (row) =>
    `${row.label} (level ${row.level}): ${row.count} ${row.gender}`,
  equivalentTitle: "Equivalent work",
  equivalentIntro: "Comparisons between equivalent groups.",
  levelsTitle: "Per level",
  levelsSignNote:
    "Signed figures: negative means women at the level earn more.",
  womenDominatedTitle: "Women-dominated groups",
  womenDominatedIntro: "Measured against out-earning comparators.",
  wdGroupLine: (group) => `${group.label} (level ${group.level})`,
  colComparator: "Compared group",
  colSpread: "Spread (P10-P90)",
  colHeadcount: "Headcount",
  colWomenShare: "Share women",
  colMean: "Avg pay",
  colDiffPct: "Diff %",
  colDiffKr: "Diff",
  noComparators: "No comparators.",
  emptyWomenDominated: "No women-dominated groups.",
  actionsTitle: "Adjustments and other measures",
  actionsIntro: "Measures with cost and timing, within three years.",
  actionScopeLabel: (scope) => scope,
  colAction: "Problem and measure",
  colOwner: "Owner",
  colDate: "Date",
  colCost: "Cost",
  colPriority: "Priority",
  colActionStatus: "Status",
  targetKindLabel: (kind) => kind,
  statusLabel: (status) => status,
  priorityLabel: (priority) => priority,
  actionTotalsLine: "1 measure, 42000 kr.",
  noActions: "No measures recorded.",
  notesTitle: "Notes",
  noteTypeLabel: (type) => type,
  noNotes: "No notes recorded.",
  evaluationTitle: "Evaluation of the previous year's measures",
  evaluationIntro: "Follow-up of Pay mapping 2025.",
  evaluationStatusNote: "Statuses as of generation.",
  noPreviousActions: "No measures in the previous mapping.",
  methodTitle: "Method and delimitations",
  methodBody: "Weighted, gender-neutral evaluation.",
  criteriaTitle: "Criteria and weights",
  colCriterion: "Criterion",
  colWeight: "Weight",
  colShare: "Share",
  pointBudgetLine: "Weight points sum to 6.",
  scopeNote: "This document covers the pay-mapping part of the documentation.",
  individualNote: "Individual-level analysis happens in the tool.",
  statisticsNote: "Medians shown under means; spread is P10-P90.",
  coverageNote: "0 singletons, 0 single-gender, 0 reverse.",
  maskingNote: "Small cells masked (0 groups).",
  measuresNote: "FTE-adjusted monthly amounts in SEK.",
  maskedCell: "-",
}

// A real 1x1 PNG: the captured-chart path must decode actual image data.
const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4Wm0HAAO3AY/3obV4AAAAAElFTkSuQmCC"

describe("PayMappingReportPdf (real render)", () => {
  it("renders to a non-trivial PDF without layout errors", async () => {
    const blob = await pdf(
      <PayMappingReportPdf doc={DOC} labels={LABELS} />
    ).toBlob()
    expect(blob.size).toBeGreaterThan(1000)
  })

  it("renders captured app charts through the image path", async () => {
    const blob = await pdf(
      <PayMappingReportPdf
        doc={DOC}
        labels={LABELS}
        chartImages={{
          population: { src: PNG_1PX, width: 160, height: 160 },
          quartiles: { src: PNG_1PX, width: 640, height: 160 },
        }}
      />
    ).toBlob()
    expect(blob.size).toBeGreaterThan(1000)
  })

  it("flows a page-exceeding action text instead of clipping it (wrap fallback)", async () => {
    // react-pdf draws an oversized wrap={false} block off the page edge and
    // the overflow is silently lost, so a very long action text must make
    // the row BREAKABLE: the document then grows by whole pages instead of
    // freezing at the same page count with invisible text (the measured
    // failure mode at roughly 2,100 characters).
    const pageCount = async (doc: ReturnType<typeof buildDoc>) => {
      const blob = await pdf(
        <PayMappingReportPdf doc={doc} labels={LABELS} />
      ).toBlob()
      return ((await blob.text()).match(/\/Type\s*\/Page[^s]/g) ?? []).length
    }
    const short = await pageCount(DOC)
    const long = await pageCount(buildDoc("word ".repeat(2400).trim()))
    expect(long).toBeGreaterThan(short + 1)
  })

  it("captures every section's page number in a first pass", async () => {
    const pageRefs: Record<string, number> = {}
    await pdf(
      <PayMappingReportPdf
        doc={DOC}
        labels={LABELS}
        onResolvePage={(id, page) => {
          pageRefs[id] = page
        }}
      />
    ).toBlob()
    for (const id of [
      "introduction",
      "collaboration",
      "praxis",
      "equalWork",
      "equivalentWork",
      "actions",
      "evaluation",
      "method",
    ]) {
      // Every section lands after the cover page, in document order.
      expect(pageRefs[id], id).toBeGreaterThan(1)
    }
    expect(pageRefs.method ?? 0).toBeGreaterThanOrEqual(
      pageRefs.introduction ?? 0
    )
  })
})
