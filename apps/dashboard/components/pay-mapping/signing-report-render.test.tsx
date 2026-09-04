import { pdf } from "@react-pdf/renderer"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { renderedText } from "@/test/pdf-text"
import type { SigningReportDoc } from "./signing-report-data"
import {
  SIGNING_SECTIONS,
  type SigningReportLabels,
  SigningReportPdf,
} from "./signing-report-doc"

const DOC: SigningReportDoc = {
  status: "draft",
  runLabel: "Pay mapping 2026",
  currency: "SEK",
  identity: {
    systemVersion: "v2-slice1",
    approvedAt: "12 Jun 2026",
    referenceDate: "1 Jul 2026",
    extractedAt: "1 Jul 2026, 09:12",
  },
  population: {
    total: 13,
    women: 7,
    men: 6,
    priced: 13,
    womenPriced: 7,
    menPriced: 6,
  },
  payPosition: {
    womenShareOfMenMeanPct: "79%",
    womenShareOfMenMedianPct: "81%",
    masked: false,
  },
  quartiles: [
    { women: 3, men: 0 },
    { women: 2, men: 1 },
    { women: 1, men: 2 },
    { women: 1, men: 3 },
  ],
  exclusions: {
    withoutPay: 0,
    singletonCount: 2,
    genderPureCount: 1,
    maskedGroupCount: 2,
  },
  collaboration: {
    participants: "Union rep",
    description: "Monthly",
    date: "15 Sep 2026",
    remarks: "The union asks for a follow-up on the QA group.",
  },
  praxis: [
    {
      key: "payPolicy",
      finding: "found",
      done: true,
      action: {
        number: 3,
        plannedAction: "Rewrite the pay policy",
        plannedDate: "1 Dec 2026",
      },
    },
    { key: "collectiveAgreements", finding: null, done: false, action: null },
    { key: "benefits", finding: "none", done: true, action: null },
    { key: "payPractices", finding: "none", done: true, action: null },
  ],
  equalWork: {
    groups: 3,
    womenAhead: 1,
    required: 1,
    assessed: 1,
    objectiveReasons: 0,
    actionsDecided: 1,
    insufficientBasis: 1,
    statuses: {
      noActionNeeded: 1,
      objectiveReason: 0,
      actionDecided: 1,
      furtherAnalysis: 0,
    },
  },
  equivalentWork: {
    womenDominatedGroups: 1,
    comparisons: 2,
    comparisonsAssessed: 2,
    objectiveReasons: 1,
    actionsDecided: 1,
    statuses: {
      noActionNeeded: 0,
      objectiveReason: 1,
      actionDecided: 1,
      furtherAnalysis: 0,
    },
  },
  actionPlan: [
    {
      area: "equalWork",
      observations: 1,
      count: 1,
      notStarted: 1,
      inProgress: 0,
      done: 0,
      cost: "42 000 kr",
      earliest: "1 Dec 2026",
      latest: "1 Dec 2026",
    },
    {
      area: "equivalentWork",
      observations: 2,
      count: 1,
      notStarted: 0,
      inProgress: 1,
      done: 0,
      cost: "500 kr/mo",
      earliest: "1 Mar 2027",
      latest: "1 Mar 2027",
    },
    {
      area: "praxis",
      observations: 1,
      count: 1,
      notStarted: 1,
      inProgress: 0,
      done: 0,
      cost: null,
      earliest: "1 Dec 2026",
      latest: "1 Dec 2026",
    },
  ],
  method: {
    criteria: [
      { name: "Knowledge", weightPoints: 4 },
      { name: "Responsibility", weightPoints: 2 },
    ],
    pointBudget: 6,
  },
  checklist: {
    allRequiredAssessed: true,
    reasonsOrActionsLinked: true,
    collaborationDocumented: true,
    sameFrozenVersion: true,
  },
  openItems: { openAnalyses: 0, actionsInProgress: 1 },
}

const LABELS: SigningReportLabels = {
  footer: "Signing report",
  identity: {
    docTitle: "Signing report",
    organizationName: "Acme AB",
    runLabel: "Pay mapping 2026",
    referenceDateLine: "Reference date 1 Jul 2026",
    extractedAtLine: "Data extracted 1 Jul 2026, 09:12",
    methodVersionLine: "Method version v2-slice1, model approved 12 Jun 2026",
    generatedOn: "Generated on 3 Sep 2026",
    statusTag: "DRAFT",
  },
  formalitiesTitle: "Formalities and signing",
  collaborationDateLine: "Collaboration date: 15 Sep 2026",
  participantsLabel: "Who takes part in the collaboration?",
  descriptionLabel: "How does the collaboration happen?",
  notDocumented: "Not yet documented.",
  appendixReference:
    "The detailed comparisons and the basis for every figure are in the detail appendix.",
  signature: {
    employer: "For the employer",
    union: "For the union party",
    name: "Name",
    signature: "Signature",
    place: "Place",
    date: "Date",
  },
  summaryTitle: "Summary and result picture",
  boxes: [
    {
      title: "Overall pay position",
      rows: [
        { label: "Women's median pay as a share of men's", value: "81%" },
        { label: "Women's average pay as a share of men's", value: "79%" },
      ],
    },
    {
      title: "Representation",
      rows: [
        { label: "Quartile 1 (lowest paid)", value: "100% women" },
        { label: "Quartile 4 (highest paid)", value: "25% women" },
      ],
    },
    {
      title: "Equal work",
      rows: [
        { label: "Groups compared", value: "3" },
        { label: "Assessments completed", value: "1 of 1" },
        { label: "Objective reasons documented", value: "0" },
        { label: "Actions decided", value: "1" },
      ],
    },
    {
      title: "Equivalent work",
      rows: [
        { label: "Women-dominated groups in scope", value: "1" },
        { label: "Relevant comparisons", value: "2" },
        { label: "Comparisons assessed", value: "2 of 2" },
        { label: "Objective reasons documented", value: "1" },
        { label: "Actions decided", value: "1" },
      ],
    },
  ],
  quartilesTitle: "Distribution per pay quartile",
  quartileRow: (index) => `Quartile ${index + 1}`,
  colWomen: "Women",
  colMen: "Men",
  chartQuartilesCaption: "Number of women and men in each pay quartile.",
  closingSentences: [
    "2 equal-work groups and 2 equivalent-work comparisons were assessed.",
    "1 action is in progress.",
    "These measures are indicators; the final assessment rests on the analysis of each relevant comparison.",
  ],
  scopeTitle: "Scope, method and confidentiality",
  scopeRows: [
    { label: "Reference date", value: "1 Jul 2026" },
    { label: "Population", value: "13 people (7 women, 6 men), 13 with pay" },
    { label: "Pay elements", value: "Base salary and recorded pay components" },
    {
      label: "Exclusions",
      value: "0 without pay, 2 single-person, 1 single-gender",
    },
  ],
  confidentialityNote:
    "Small groups are masked here but analysed, and shown in full in the appendix. 2 groups have insufficient basis for broad reporting.",
  praxisTitle: "Provisions, practice and collaboration",
  colArea: "Area",
  colConclusion: "Conclusion",
  colFollowUp: "Action or follow-up",
  praxisRows: [
    {
      area: "Pay policy",
      conclusion: "Needs review",
      followUp: "#3 Rewrite the pay policy, 1 Dec 2026",
    },
    { area: "Collective agreements", conclusion: "Pending", followUp: "–" },
    { area: "Benefits and variable pay", conclusion: "Clear", followUp: "–" },
    { area: "Pay-setting practice", conclusion: "Clear", followUp: "–" },
    { area: "Collaboration", conclusion: "Performed", followUp: "15 Sep 2026" },
  ],
  equalWorkTitle: "Equal work",
  equalWorkRows: [
    { label: "Comparable groups", value: "3" },
    { label: "Of which groups where women are ahead", value: "1" },
    { label: "Assessments completed", value: "1 of 1" },
    { label: "Objective reasons documented", value: "0" },
    { label: "Actions decided", value: "1" },
    {
      label: "Equal-work groups with insufficient basis for broad reporting",
      value: "1",
    },
  ],
  equalWorkConclusion:
    "Every relevant difference has one of four statuses. Both directions are counted above; the documentation duty covers the differences where women are paid less.",
  equivalentTitle: "Equivalent work",
  chainLine:
    "Role evaluation, women-dominated group, relevant higher-paid comparison group, assessment, action or close.",
  equivalentRows: [
    { label: "Women-dominated groups in scope", value: "1" },
    { label: "Relevant comparisons", value: "2" },
    { label: "Comparisons assessed", value: "2 of 2" },
    { label: "Objective reasons documented", value: "1" },
    { label: "Actions decided", value: "1" },
  ],
  actionPlanTitle: "Action plan and follow-up",
  colObservation: "Observation",
  colActions: "Actions",
  colStatusSplit: "Status",
  colResponsible: "Responsible function",
  colCost: "Estimated cost",
  colDates: "Planned",
  actionPlanRows: [
    {
      area: "Equal work",
      observation: "1 group requiring assessment",
      actions: "1",
      statusSplit: "1 not started",
      responsible: "HR and line management",
      cost: "42 000 kr",
      dates: "1 Dec 2026",
    },
    {
      area: "Equivalent work",
      observation: "2 comparisons",
      actions: "1",
      statusSplit: "1 in progress",
      responsible: "HR and line management",
      cost: "500 kr/mo",
      dates: "1 Mar 2027",
    },
    {
      area: "Practice",
      observation: "1 area with a finding",
      actions: "1",
      statusSplit: "1 not started",
      responsible: "HR",
      cost: null,
      dates: "1 Dec 2026",
    },
  ],
  noActions: "No actions recorded.",
  methodTitle: "Method note",
  methodLines: [
    "Equal work is role and level.",
    "Equivalent work is the documented gender-neutral evaluation of demands: Knowledge (4), Responsibility (2).",
    "Pay elements: base salary and recorded pay components, FTE-adjusted.",
    "The full method and calculation basis are in the detail appendix.",
  ],
  checklistTitle: "Before signing",
  checklistRows: [
    {
      label: "All comparisons requiring documentation are assessed",
      done: true,
    },
    { label: "Reasons or actions are linked", done: true },
    { label: "Collaboration is documented", done: true },
    { label: "Both documents derive from the same frozen version", done: true },
  ],
  checklistDone: "Done",
  checklistOpen: "Open",
  maskedCell: "–",
}

describe("SigningReportPdf (real render)", () => {
  it("renders to a non-trivial PDF without layout errors", async () => {
    const blob = await pdf(
      <SigningReportPdf doc={DOC} labels={LABELS} />
    ).toBlob()
    expect(blob.size).toBeGreaterThan(1000)
  })

  it("captures every section's page number, in document order, within eight pages", async () => {
    const pageRefs: Record<string, number> = {}
    await pdf(
      <SigningReportPdf
        doc={DOC}
        labels={LABELS}
        onResolvePage={(id, page) => {
          pageRefs[id] = page
        }}
      />
    ).toBlob()
    let previous = 0
    for (const id of SIGNING_SECTIONS) {
      expect(pageRefs[id], id).toBeGreaterThanOrEqual(previous)
      previous = pageRefs[id] ?? 0
    }
    expect(pageRefs.formalities).toBe(1)
    expect(pageRefs.method).toBeLessThanOrEqual(8)
  })

  // Every measure counts what its label says, in the unit the statutory
  // table draws. The blob is compressed, so the assertion reads the element
  // tree the component builds.
  it("prints both directions, the x-of-y completion rows and the responsible function", () => {
    const text = renderedText(
      SigningReportPdf({ doc: DOC, labels: LABELS }) as ReactNode
    )
    // Section 5: the compared total and the direction split under it.
    expect(text).toContain("Comparable groups")
    expect(text).toContain("Of which groups where women are ahead")
    // Both completion rows read as "x of y", in the unit their label names.
    expect(text.filter((part) => part === "Comparisons assessed")).toHaveLength(
      2
    )
    expect(text.filter((part) => part === "2 of 2")).toHaveLength(2)
    // Section 7's responsible cell is a function, never an owner name.
    expect(text).toContain("Responsible function")
    expect(text).toContain("HR and line management")
    expect(text).toContain("HR")
    expect(text).not.toContain("HR Person")
    // The summary page's indicator caveat and the method note's pointer at
    // the appendix's own method chapter.
    expect(text).toContain(
      "These measures are indicators; the final assessment rests on the analysis of each relevant comparison."
    )
    expect(text).toContain(
      "The full method and calculation basis are in the detail appendix."
    )
  })

  it("renders without a collaboration record and with an empty action plan", async () => {
    const blob = await pdf(
      <SigningReportPdf
        doc={{ ...DOC, collaboration: null, actionPlan: [] }}
        labels={{ ...LABELS, actionPlanRows: [] }}
      />
    ).toBlob()
    expect(blob.size).toBeGreaterThan(1000)
  })

  it("grows by whole pages when the collaboration description exceeds a page", async () => {
    const pageCount = async (doc: SigningReportDoc) => {
      const blob = await pdf(
        <SigningReportPdf doc={doc} labels={LABELS} />
      ).toBlob()
      return ((await blob.text()).match(/\/Type\s*\/Page[^s]/g) ?? []).length
    }
    const short = await pageCount(DOC)
    const long = await pageCount({
      ...DOC,
      collaboration: {
        participants: "Union rep",
        description: "word ".repeat(2400).trim(),
        date: null,
        remarks: null,
      },
    })
    expect(long).toBeGreaterThan(short)
  })
})
