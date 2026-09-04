import { pdf } from "@react-pdf/renderer"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { computeHeaderBreaks } from "@/components/pdf/pdf-table"
import { renderedText } from "@/test/pdf-text"
import {
  makeExcluded,
  makeFrozenCriterion,
  makeGapGroup,
  makeGapResult,
  makeRunDetail,
} from "@/test/pay-mapping-fixtures"
import {
  APPENDIX_SECTIONS,
  type DetailAppendixLabels,
  DetailAppendixPdf,
  detailAppendixTables,
} from "./detail-appendix-doc"
import type {
  PayMappingActionWire,
  PayMappingNoteWire,
} from "./pay-mapping-gap-types"
import {
  assemblePayMappingReport,
  type ReportFormatters,
} from "./pay-mapping-report-data"
import { detailAppendixDoc } from "./signing-report-data"

// Eight priced people (4 women, 4 men) in one group, so the medians and
// spread compute through the real engine.
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

const FORMATTERS: ReportFormatters = {
  money: (value) => `${Math.round(value)} kr`,
  pct: (value) => `${value}%`,
  date: (epochMs) => new Date(epochMs).toISOString().slice(0, 10),
  dateTime: (epochMs) => new Date(epochMs).toISOString(),
  costUnitSuffix: (unit) =>
    unit === null || unit === "oneOff" ? "" : `/${unit}`,
}

const PRAXIS_AREA_LABEL = (area: string) => `Area ${area}`

// A builder rather than one const: the pagination regression renders the
// same document again with an action's or a praxis area's free text grown
// past a page.
function buildDoc(
  problemText = "Unexplained gap",
  praxisNote = "Unclear criteria"
) {
  return detailAppendixDoc(
    assemblePayMappingReport({
      run: makeRunDetail({
        status: "completed",
        collaboration: {
          participants: "Union rep",
          description: "Monthly sync",
          date: 1_700_000_000_000,
          remarks: "The union asks for a follow-up on the QA group.",
        },
        frozenMethod: {
          criteria: [
            makeFrozenCriterion({
              name: "Knowledge",
              weightPoints: 4,
              dimensionKey: "competence",
            }),
            makeFrozenCriterion({
              name: "Responsibility",
              weightPoints: 2,
              dimensionKey: "responsibility",
            }),
          ],
          levelRules: [
            { level: 1, minScore: 90 },
            { level: 2, minScore: 80 },
          ],
          zoneProfileRules: [{ zone: "A", minStep: 4 }],
          workingConditions: { status: "active", motivation: "Exposure" },
          approvedAt: 1_690_000_000_000,
        },
        rows: ROWS,
      }),
      gap: makeGapResult({
        equalWork: [
          makeGapGroup({ key: "SWE|3" }),
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
          groupKey: "SWE|3",
          comparisonKey: null,
          reasons: ["experience"],
          note: "Documented",
          done: true,
          finding: null,
        },
        {
          scope: "praxis",
          groupKey: "payPolicy",
          comparisonKey: null,
          reasons: [],
          note: praxisNote,
          done: true,
          finding: "found",
        },
      ],
      actions: [
        {
          actionId: "a1" as Id<"payMappingActions">,
          number: 1,
          target: { kind: "group", scope: "equalWork", groupKey: "SWE|3" },
          problem: problemText,
          plannedAction: "Salary review",
          reason: "experience",
          ownerUserId: "u1",
          ownerName: "HR Person",
          plannedDate: 1_700_000_000_000,
          estimatedCost: 42000,
          estimatedCostUnit: "oneOff",
          priority: "high",
          status: "notStarted",
          erased: false,
          createdAt: 1,
        },
        // An erasure-tombstoned person-targeted action (ADR-0027).
        {
          actionId: "a2" as Id<"payMappingActions">,
          number: 2,
          target: {
            kind: "person",
            scope: "equalWork",
            groupKey: "SWE|3",
            personPublicId: "p1",
          },
          problem: "",
          plannedAction: "",
          reason: null,
          ownerUserId: "u1",
          ownerName: "HR Person",
          plannedDate: 1_700_000_000_000,
          estimatedCost: 500,
          estimatedCostUnit: "perMonth",
          priority: "medium",
          status: "inProgress",
          erased: true,
          createdAt: 2,
        },
        {
          actionId: "a3" as Id<"payMappingActions">,
          number: 3,
          target: { kind: "praxis", area: "payPolicy" },
          problem: "Managers read the policy differently",
          plannedAction: "Rewrite the pay policy",
          reason: null,
          ownerUserId: "u1",
          ownerName: "HR Person",
          plannedDate: 1_700_000_000_000,
          estimatedCost: null,
          estimatedCostUnit: null,
          priority: "medium",
          status: "notStarted",
          erased: false,
          createdAt: 3,
        },
      ],
      notes: [
        {
          noteId: "n1" as PayMappingNoteWire["noteId"],
          target: { kind: "group", scope: "equalWork", groupKey: "SWE|3" },
          text: "Discuss at the next samverkan meeting",
          noteType: "discussionNeeded",
          erased: false,
          createdBy: "u1",
          createdByName: "HR Person",
          createdAt: 3,
        },
      ],
      previous: {
        runLabel: "Pay mapping 2025",
        referenceDate: 1_680_000_000_000,
        actions: [
          {
            actionId: "b1" as Id<"payMappingActions">,
            number: 1,
            target: { kind: "group", scope: "equalWork", groupKey: "SWE|3" },
            problem: "Last year's gap",
            plannedAction: "Adjust",
            reason: null,
            ownerUserId: "u1",
            ownerName: "HR Person",
            plannedDate: 1_690_000_000_000,
            estimatedCost: 1000,
            estimatedCostUnit: "perMonth",
            priority: "low",
            status: "done",
            erased: false,
            createdAt: 1,
          } satisfies PayMappingActionWire,
        ],
        gap: makeGapResult({
          equalWork: [
            makeGapGroup({
              key: "SWE|3",
              metric: { gapPct: 12, gapKr: 12000 },
            }),
          ],
        }),
      },
      formatters: FORMATTERS,
      praxisAreaLabel: PRAXIS_AREA_LABEL,
    })
  )
}

// The branches the main fixture never reaches: a women-ahead group (its own
// table on its own page) and a single-gender group (the list under it).
function buildExcludedDoc() {
  return detailAppendixDoc(
    assemblePayMappingReport({
      run: makeRunDetail({ status: "completed", rows: ROWS }),
      gap: makeGapResult({
        equalWork: [makeGapGroup({ key: "SWE|3" })],
        excluded: makeExcluded({
          // More reverse rows than a page holds beside the equal-work row:
          // react-pdf only examines a nested `break` while the page is being
          // split, so a chapter that fits on one page would keep the reverse
          // table on it and prove nothing about the break.
          reverse: Array.from({ length: 30 }, (_, index) =>
            makeGapGroup({
              key: `Design|${index}`,
              roleTitle: "Design",
              level: index,
              flag: "ok",
              metric: { gapPct: -8, gapKr: -8000 },
            })
          ),
          genderPure: [
            {
              key: "Ops|5",
              roleTitle: "Ops",
              seniority: null,
              level: 5,
              gender: "Man",
              count: 3,
            },
          ],
        }),
      }),
      analyses: [],
      actions: [],
      notes: [],
      previous: null,
      formatters: FORMATTERS,
      praxisAreaLabel: PRAXIS_AREA_LABEL,
    })
  )
}

// A mapping with nothing recorded yet: every empty-state label renders and
// every praxis area stands without a note.
function buildBareDoc() {
  return detailAppendixDoc(
    assemblePayMappingReport({
      run: makeRunDetail({ status: "completed" }),
      gap: makeGapResult(),
      analyses: [],
      actions: [],
      notes: [],
      previous: null,
      formatters: FORMATTERS,
      praxisAreaLabel: PRAXIS_AREA_LABEL,
    })
  )
}

const DOC = buildDoc()

const LABELS: DetailAppendixLabels = {
  footer: "Detail appendix",
  identity: {
    docTitle: "Detail appendix",
    organizationName: "Acme AB",
    runLabel: "Pay mapping 2026",
    referenceDateLine: "Reference date 2026-07-01",
    extractedAtLine: "Data extracted 2026-07-01T00:00:00.000Z",
    methodVersionLine: "Method version v2-slice1, model approved 2023-07-22",
    generatedOn: "Generated on 2026-09-03",
    statusTag: "FINAL",
  },
  classification:
    "Internal document. Contains person-near pay data. Every download is logged.",
  contentsTitle: "Contents",
  equalWorkTitle: "Equal work, in full",
  equivalentTitle: "Equivalent work, in full",
  equivalentChainLine:
    "Role evaluation, women-dominated group, relevant higher-paid comparison group, assessment, and then action or close.",
  praxisTitle: "Practice, collaboration remarks and actions",
  methodTitle: "Method and calculation basis",
  colGroup: "Group",
  colLevel: "Level",
  colWomen: "Women",
  colMen: "Men",
  colTccWomen: "Total W",
  colTccMen: "Total M",
  colTccGapKr: "Gap",
  colTccGapPct: "Gap %",
  colStatus: "Status",
  medianLine: (median) =>
    `Median: women ${median.women ?? "-"}, men ${median.men ?? "-"}, gap ${median.gapPct ?? "-"}`,
  baseLine: (base) =>
    `Base: women ${base.womenMean ?? "-"}, men ${base.menMean ?? "-"}, gap ${base.gapPct ?? "-"}`,
  flagLabel: (flag) => flag,
  statusLabel: (status) => status,
  baseDrivenMarker: "*",
  baseDrivenNote: "* flagged on base salary",
  prevYearLine: (gapPct) => `Previous pay mapping: ${gapPct}`,
  reasonsLabel: "Objective reasons",
  noteLabel: "Note",
  actionsLabel: "Actions",
  reasonLabel: (reason) => reason,
  linkedActionLine: (action) =>
    `#${action.number} ${action.ownerName}, ${action.plannedDate}`,
  undocumented: "Not documented yet.",
  levelText: (level) => (level === null ? "-" : String(level)),
  emptyEqualWork: "No groups.",
  reverseTitle: "Groups where women are ahead",
  genderPureTitle: "Single-gender groups",
  genderPureRow: (row) => `${row.label} (level ${row.level}): ${row.count}`,
  wdGroupLine: (group) =>
    `${group.label} (level ${group.level}, ${group.headcount} people, ${group.womenSharePct} women, mean ${group.meanComp}, spread ${group.spread ?? "-"})`,
  colComparator: "Compared group",
  colHeadcount: "Headcount",
  colWomenShare: "Share women",
  colMean: "Avg pay",
  colSpread: "Spread",
  colDiffPct: "Diff %",
  colDiffKr: "Diff",
  noComparators: "No comparators.",
  emptyWomenDominated: "No women-dominated groups.",
  praxisAreaTitle: (key) => `Area ${key}`,
  findingLabel: (finding) => {
    if (finding === "none") return "Clear"
    return finding === "found" ? "Needs review" : "Pending"
  },
  praxisActionLine: (action) =>
    `#${action.number} ${action.plannedAction}, ${action.plannedDate}`,
  previousEvaluationTitle: "Previous actions (Pay mapping 2025)",
  noPreviousActions: "No measures in the previous mapping.",
  collaborationTitle: "Collaboration",
  participantsLabel: "Who takes part?",
  descriptionLabel: "How does it happen?",
  collaborationDateLabel: "Collaboration date",
  collaborationRemarksLabel: "Remarks from the parties",
  notDocumented: "Not yet documented.",
  actionsTitle: "Actions",
  colNumber: "No.",
  colTarget: "Linked to",
  colProblem: "Problem and measure",
  colReason: "Reason",
  colOwner: "Owner",
  colDate: "Date",
  colCost: "Cost",
  colPriority: "Priority",
  colActionStatus: "Status",
  targetKindLabel: (kind) => kind,
  actionStatusLabel: (status) => status,
  priorityLabel: (priority) => priority,
  erasedContent: "Content removed when the person was erased.",
  noActions: "No measures recorded.",
  notesTitle: "Notes",
  noteTypeLabel: (type) => type,
  noNotes: "No notes recorded.",
  definitionsTitle: "Definitions",
  defEqualWork: "Equal work is the same role at the same level.",
  defEquivalentWork:
    "Equivalent work is the documented gender-neutral evaluation of demands.",
  criteriaTitle: "Criteria and weights",
  criterionPurpose: "What it measures",
  criterionRelevance: "Why it is relevant",
  criterionWeightMotivation: "Why this weight",
  colCriterion: "Criterion",
  colDimension: "Dimension",
  colWeight: "Weight",
  colShare: "Share",
  dimensionLabel: (key) => key,
  pointBudgetLine: "Weight points sum to 6.",
  dimensionSharesTitle: "Share per dimension",
  levelRulesTitle: "Level rules",
  colMinScore: "Min score",
  zoneRulesTitle: "Zone rules",
  zoneRuleLine: (rule) => `Zone ${rule.zone}: at least step ${rule.minStep}`,
  workingConditionsLine: "Working conditions: judged material. Exposure",
  scaleNote:
    "Criteria are rated on a 1 to 5 scale; steps 2 and 4 are midpoints.",
  differenceNote:
    "Difference is the men's mean minus the women's, of the men's mean.",
  measuresNote: "FTE-adjusted monthly amounts in SEK.",
  thresholdsNote: "Flags at 10% and 5%; women-dominated at 60% women.",
  hourlyDefaultLine: "Full-time hours per month: 165.",
  hourlyNote: null,
  coverageNote: "0 singletons, 0 single-gender, 0 reverse.",
  unmaskedNote: "Nothing is masked in this document.",
  maskedCell: "-",
}

async function pageCount(doc: ReturnType<typeof buildDoc>) {
  const blob = await pdf(
    <DetailAppendixPdf doc={doc} labels={LABELS} />
  ).toBlob()
  return ((await blob.text()).match(/\/Type\s*\/Page[^s]/g) ?? []).length
}

describe("DetailAppendixPdf (real render)", () => {
  it("renders to a non-trivial PDF without layout errors", async () => {
    const blob = await pdf(
      <DetailAppendixPdf doc={DOC} labels={LABELS} />
    ).toBlob()
    expect(blob.size).toBeGreaterThan(1000)
  })

  it("captures every chapter's page number after the cover, in order", async () => {
    const pageRefs: Record<string, number> = {}
    await pdf(
      <DetailAppendixPdf
        doc={DOC}
        labels={LABELS}
        onResolvePage={(id, page) => {
          pageRefs[id] = page
        }}
      />
    ).toBlob()
    let previous = 1
    for (const id of APPENDIX_SECTIONS) {
      expect(pageRefs[id], id).toBeGreaterThan(1)
      expect(pageRefs[id], id).toBeGreaterThanOrEqual(previous)
      previous = pageRefs[id] ?? 0
    }
  })

  it("flows a page-exceeding action text instead of clipping it (wrap fallback)", async () => {
    const short = await pageCount(DOC)
    const long = await pageCount(buildDoc("word ".repeat(2400).trim()))
    expect(long).toBeGreaterThan(short + 1)
  })

  it("flows a page-exceeding praxis note instead of clipping it (wrap fallback)", async () => {
    const short = await pageCount(DOC)
    const long = await pageCount(
      buildDoc(undefined, "word ".repeat(2400).trim())
    )
    expect(long).toBeGreaterThan(short + 1)
  })

  it("renders the reverse table and the single-gender list", async () => {
    const rowPages: Record<string, number> = {}
    const blob = await pdf(
      <DetailAppendixPdf
        doc={buildExcludedDoc()}
        labels={LABELS}
        onRowPage={(id, page) => {
          rowPages[id] = page
        }}
      />
    ).toBlob()
    expect(blob.size).toBeGreaterThan(1000)
    const pagesFor = (prefix: string) =>
      Object.entries(rowPages)
        .filter(([id]) => id.startsWith(prefix))
        .map(([, page]) => page)
    const equalWorkPages = pagesFor("equalWork:")
    const reversePages = pagesFor("reverse:")
    expect(equalWorkPages).toHaveLength(1)
    expect(reversePages).toHaveLength(30)
    // The reverse table starts on a page of its own, past every equal-work
    // row, and its own rows flow from there.
    expect(Math.min(...reversePages)).toBeGreaterThan(
      Math.max(...equalWorkPages)
    )
  })

  it("prints every group's base salary on the row's sub-line, not as columns", async () => {
    const baseLine = vi.fn(LABELS.baseLine)
    await pdf(
      <DetailAppendixPdf doc={DOC} labels={{ ...LABELS, baseLine }} />
    ).toBlob()
    // Every group row's OWN base metric reaches the sub-line that already
    // carries the medians. Eleven columns do not fit an A4 portrait page,
    // so the base pair rides under the row rather than in it.
    expect(new Set(baseLine.mock.calls.map(([base]) => base))).toEqual(
      new Set(DOC.equalWork.map((row) => row.base))
    )
  })

  // The appendix stands alone as a review document: the method chapter has
  // to define the two statutory terms, say what every criterion measures and
  // state how a difference is computed, none of which is derivable from the
  // tables. The PDF blob is compressed, so the assertion reads the element
  // tree the component builds rather than the rendered bytes.
  it("prints the definitions, the criterion documentation and the calculation rule", () => {
    const doc = detailAppendixDoc(
      assemblePayMappingReport({
        run: makeRunDetail({
          status: "completed",
          rows: ROWS,
          frozenMethod: {
            criteria: [
              makeFrozenCriterion({
                name: "Knowledge",
                weightPoints: 4,
                purpose: "Depth of professional knowledge",
                whyRelevant: "The work turns on applied expertise",
                weightMotivation: "The heaviest demand here",
              }),
              makeFrozenCriterion({ name: "Responsibility", weightPoints: 2 }),
            ],
            levelRules: [],
            zoneProfileRules: [],
            workingConditions: null,
            approvedAt: null,
          },
        }),
        gap: makeGapResult(),
        analyses: [],
        actions: [],
        notes: [],
        previous: null,
        formatters: FORMATTERS,
        praxisAreaLabel: PRAXIS_AREA_LABEL,
      })
    )
    const text = renderedText(
      DetailAppendixPdf({ doc, labels: LABELS }) as ReactNode
    )
    expect(text).toContain(LABELS.definitionsTitle)
    expect(text).toContain(LABELS.defEqualWork)
    expect(text).toContain(LABELS.defEquivalentWork)
    expect(text).toContain(LABELS.differenceNote)
    // The documented criterion prints all three labeled sub-lines.
    expect(text).toContain(LABELS.criterionPurpose)
    expect(text).toContain("Depth of professional knowledge")
    expect(text).toContain(LABELS.criterionRelevance)
    expect(text).toContain("The work turns on applied expertise")
    expect(text).toContain(LABELS.criterionWeightMotivation)
    expect(text).toContain("The heaviest demand here")
    // The undocumented one prints its row and nothing under it: exactly one
    // set of sub-line labels for two criteria.
    expect(
      text.filter((part) => part === LABELS.criterionPurpose)
    ).toHaveLength(1)
  })

  it("prints the collaboration remarks the practice chapter is titled for", () => {
    const text = renderedText(
      DetailAppendixPdf({ doc: DOC, labels: LABELS }) as ReactNode
    )
    expect(text).toContain(LABELS.collaborationRemarksLabel)
    expect(text).toContain(DOC.collaboration?.remarks)
  })

  // A model that documents several criteria produces more sub-lines than one
  // page holds; the criteria block must flow rather than be dropped whole.
  it("flows a fully documented criteria table onto further pages", async () => {
    const long = "word ".repeat(400).trim()
    const documented = detailAppendixDoc(
      assemblePayMappingReport({
        run: makeRunDetail({
          status: "completed",
          rows: ROWS,
          frozenMethod: {
            criteria: Array.from({ length: 6 }, (_, index) =>
              makeFrozenCriterion({
                name: `Criterion ${index}`,
                weightPoints: 3,
                purpose: long,
                whyRelevant: long,
                weightMotivation: long,
              })
            ),
            levelRules: [],
            zoneProfileRules: [],
            workingConditions: null,
            approvedAt: null,
          },
        }),
        gap: makeGapResult(),
        analyses: [],
        actions: [],
        notes: [],
        previous: null,
        formatters: FORMATTERS,
        praxisAreaLabel: PRAXIS_AREA_LABEL,
      })
    )
    const blob = await pdf(
      <DetailAppendixPdf doc={documented} labels={LABELS} />
    ).toBlob()
    const pages = ((await blob.text()).match(/\/Type\s*\/Page[^s]/g) ?? [])
      .length
    expect(pages).toBeGreaterThan(await pageCount(DOC))
  })

  it("renders every empty state when nothing is recorded yet", async () => {
    const blob = await pdf(
      <DetailAppendixPdf doc={buildBareDoc()} labels={LABELS} />
    ).toBlob()
    expect(blob.size).toBeGreaterThan(1000)
  })

  it("reports every table row's page so continuation headers can be derived", async () => {
    const rowPages: Record<string, number> = {}
    await pdf(
      <DetailAppendixPdf
        doc={DOC}
        labels={LABELS}
        onRowPage={(id, page) => {
          rowPages[id] = page
        }}
      />
    ).toBlob()
    const tables = detailAppendixTables(DOC)
    for (const ids of tables) {
      for (const id of ids) expect(rowPages[id], id).toBeGreaterThan(1)
    }
    const breaks = computeHeaderBreaks(tables, rowPages)
    // A table whose rows share a page never asks for a continuation header.
    expect(tables[0]?.some((id) => breaks.has(id))).toBe(false)
    // The action table is the one that spills onto a second page in this
    // fixture, and exactly its first row there carries the re-rendered
    // header on the next pass.
    expect([...breaks]).toEqual([expect.stringMatching(/^actions:/)])
  })
})
