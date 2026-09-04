import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { describe, expect, it } from "vitest"
import {
  EXPORT_MIN_GROUP_SIZE,
  EXPORT_MIN_PER_GENDER,
  exportMasksGenderMeans,
  exportMasksWholeGroupMean,
} from "@/lib/pay-mapping-masking"
import {
  makeExcluded,
  makeFrozenCriterion,
  makeGapGroup,
  makeGapResult,
  makeRunDetail,
} from "@/test/pay-mapping-fixtures"
import type {
  GroupAnalysis,
  PayMappingActionWire,
  PayMappingGapResult,
  PayMappingSnapshotRow,
} from "./pay-mapping-gap-types"
import {
  assemblePayMappingReport,
  type ReportFormatters,
} from "./pay-mapping-report-data"
import { detailAppendixDoc, signingReportDoc } from "./signing-report-data"

// Marker formatters: every money figure is "M<n>", so a group amount that
// leaks into the signing doc is a string the scan below can find.
const formatters: ReportFormatters = {
  money: (value) => `M${value}`,
  pct: (value) => `P${value}`,
  date: (epochMs) => `D${epochMs}`,
  dateTime: (epochMs) => `T${epochMs}`,
  costUnitSuffix: (unit) =>
    unit === null || unit === "oneOff" ? "" : `/${unit}`,
}

function row(
  index: number,
  gender: "Kvinna" | "Man",
  roleTitle: string,
  level: number,
  pay: number
): PayMappingSnapshotRow {
  return {
    personPublicId: `p${index}`,
    displayName: `Person ${index}`,
    erased: false,
    gender,
    roleTitle,
    trackKey: "ic",
    seniority: "Mid",
    level,
    basicMonthly: pay,
    components: [],
  }
}

// Two equal-work groups: SWE (2 women, 2 men, above the thresholds) and QA
// (1 woman, 3 men, under the per-gender floor); one women-dominated group
// (Nurse, 5 people) measured against Support (4) and Clerk (3, under the
// whole-group floor).
const ROWS: PayMappingSnapshotRow[] = [
  row(1, "Kvinna", "SWE", 3, 90000),
  row(2, "Kvinna", "SWE", 3, 90000),
  row(3, "Man", "SWE", 3, 100000),
  row(4, "Man", "SWE", 3, 100000),
  row(5, "Kvinna", "QA", 4, 50000),
  row(6, "Man", "QA", 4, 52000),
  row(7, "Man", "QA", 4, 52000),
  row(8, "Man", "QA", 4, 52000),
  row(9, "Kvinna", "Nurse", 2, 40000),
  row(10, "Kvinna", "Nurse", 2, 40000),
  row(11, "Kvinna", "Nurse", 2, 40000),
  row(12, "Kvinna", "Nurse", 2, 40000),
  row(13, "Man", "Nurse", 2, 40000),
]

function makeAction(
  overrides: Partial<PayMappingActionWire> = {}
): PayMappingActionWire {
  return {
    actionId: "a1" as Id<"payMappingActions">,
    number: 1,
    target: { kind: "group", scope: "equalWork", groupKey: "SWE|3" },
    problem: "Unexplained gap",
    plannedAction: "Salary review",
    reason: "experience",
    ownerUserId: "u1",
    ownerName: "HR Person",
    plannedDate: 1000,
    estimatedCost: 42000,
    estimatedCostUnit: "oneOff",
    priority: "high",
    status: "notStarted",
    erased: false,
    createdAt: 1,
    ...overrides,
  }
}

const ANALYSES: GroupAnalysis[] = [
  {
    scope: "equalWork",
    groupKey: "SWE|3",
    comparisonKey: null,
    reasons: ["experience"],
    note: null,
    done: true,
    finding: null,
  },
  {
    scope: "equivalentWork",
    groupKey: "Nurse|2",
    comparisonKey: null,
    reasons: [],
    note: null,
    done: true,
    finding: null,
  },
  {
    scope: "equivalentWork",
    groupKey: "Nurse|2",
    comparisonKey: "Support|3",
    reasons: ["historicalPay"],
    note: null,
    done: false,
    finding: null,
  },
  {
    scope: "praxis",
    groupKey: "payPolicy",
    comparisonKey: null,
    reasons: [],
    note: "Unclear criteria",
    done: true,
    finding: "found",
  },
  {
    scope: "praxis",
    groupKey: "benefits",
    comparisonKey: null,
    reasons: [],
    note: null,
    done: true,
    finding: "none",
  },
]

const ACTIONS: PayMappingActionWire[] = [
  makeAction(),
  makeAction({
    actionId: "a2" as Id<"payMappingActions">,
    number: 2,
    target: {
      kind: "comparison",
      groupKey: "Nurse|2",
      comparisonKey: "Clerk|3",
    },
    estimatedCost: 500,
    estimatedCostUnit: "perMonth",
    status: "inProgress",
    plannedDate: 3000,
  }),
  makeAction({
    actionId: "a3" as Id<"payMappingActions">,
    number: 3,
    target: { kind: "praxis", area: "payPolicy" },
    plannedAction: "Rewrite the pay policy",
    estimatedCost: null,
    estimatedCostUnit: null,
    plannedDate: 2000,
  }),
]

function full(
  gapOverrides: Partial<PayMappingGapResult> = {},
  extraActions: PayMappingActionWire[] = [],
  analyses: GroupAnalysis[] = ANALYSES
) {
  return assemblePayMappingReport({
    run: makeRunDetail({
      status: "active",
      rows: ROWS,
      populationCount: 13,
      collaboration: {
        participants: "Union rep",
        description: "Monthly",
        date: 4000,
        remarks: "The parties ask for a follow-up before the next mapping.",
      },
      frozenMethod: {
        criteria: [
          makeFrozenCriterion({ name: "Knowledge", weightPoints: 4 }),
          makeFrozenCriterion({ name: "Responsibility", weightPoints: 2 }),
        ],
        levelRules: [],
        zoneProfileRules: [],
        workingConditions: null,
        approvedAt: 1_700_000_000_000,
      },
    }),
    gap: makeGapResult({
      org: {
        womenCount: 7,
        menCount: 6,
        womenMeanComp: 60000,
        menMeanComp: 76000,
        gapPct: 21,
        flag: "critical",
      },
      population: { women: 7, men: 6 },
      equalWork: [
        makeGapGroup({ key: "SWE|3", roleTitle: "SWE", level: 3 }),
        makeGapGroup({
          key: "QA|4",
          roleTitle: "QA",
          level: 4,
          womenCount: 1,
          menCount: 3,
          flag: "ok",
          metric: {
            womenMean: 50000,
            menMean: 52000,
            gapPct: 3.8,
            gapKr: 2000,
          },
        }),
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
            {
              key: "Clerk|3",
              roleTitle: "Clerk",
              seniority: null,
              level: 3,
              headcount: 3,
              womenSharePct: 33,
              meanComp: 47000,
              diffPct: 17.5,
              diffSek: 7000,
            },
          ],
        },
      ],
      quartiles: [
        { women: 3, men: 0 },
        { women: 2, men: 1 },
        { women: 1, men: 2 },
        { women: 1, men: 3 },
      ],
      ...gapOverrides,
    }),
    analyses,
    actions: [...ACTIONS, ...extraActions],
    notes: [],
    previous: null,
    formatters,
    praxisAreaLabel: (area) => `Area ${area}`,
  })
}

describe("export-boundary thresholds (ADR-0012, lib/pay-mapping-masking.ts)", () => {
  it("keeps the values 4 and 2", () => {
    expect(EXPORT_MIN_GROUP_SIZE).toBe(4)
    expect(EXPORT_MIN_PER_GENDER).toBe(2)
  })
  it("masks per-gender means below the small-cell minimums", () => {
    expect(exportMasksGenderMeans({ womenCount: 2, menCount: 2 })).toBe(false)
    expect(exportMasksGenderMeans({ womenCount: 1, menCount: 3 })).toBe(true)
    expect(exportMasksGenderMeans({ womenCount: 3, menCount: 1 })).toBe(true)
    expect(exportMasksGenderMeans({ womenCount: 2, menCount: 1 })).toBe(true)
  })
  it("masks a whole-group mean only below the total minimum", () => {
    expect(exportMasksWholeGroupMean(4)).toBe(false)
    expect(exportMasksWholeGroupMean(3)).toBe(true)
  })
})

describe("signingReportDoc", () => {
  it("carries no amount from any group, on the typed shape and in its text", () => {
    const doc = full()
    const signing = signingReportDoc(doc)
    const text = JSON.stringify(signing)
    // Every group-level money marker the full doc carries.
    for (const amount of [
      "M90000",
      "M100000",
      "M10000",
      "M50000",
      "M52000",
      "M2000",
      "M40000",
      "M45000",
      "M5000",
      "M47000",
      "M7000",
    ]) {
      expect(text, amount).not.toContain(amount)
    }
    // No group names either: the signing report is counts and statuses.
    for (const name of ["SWE", "QA", "Nurse", "Support", "Clerk"]) {
      expect(text, name).not.toContain(name)
    }
    // The only money is the aggregated action cost per area.
    expect(
      signing.actionPlan.find((area) => area.area === "equalWork")?.cost
    ).toBe("M42000")
    expect(
      signing.actionPlan.find((area) => area.area === "equivalentWork")?.cost
    ).toBe("M500/perMonth")
  })

  it("masks the org pay position only under the per-gender floor", () => {
    const signing = signingReportDoc(full())
    expect(signing.payPosition.masked).toBe(false)
    expect(signing.payPosition.womenShareOfMenMeanPct).toBe(
      `P${(60000 / 76000) * 100}`
    )
    const tiny = signingReportDoc({
      ...full(),
      population: { ...full().population, menPriced: 3 },
    })
    expect(tiny.payPosition.masked).toBe(true)
    expect(tiny.payPosition.womenShareOfMenMeanPct).toBeNull()
    expect(tiny.payPosition.womenShareOfMenMedianPct).toBeNull()
    // Either leg under the floor masks: the share is a comparison BETWEEN the
    // two genders, so a thin women's side exposes them exactly as a thin
    // men's side does.
    const tinyWomen = signingReportDoc({
      ...full(),
      population: { ...full().population, womenPriced: 3 },
    })
    expect(tinyWomen.payPosition.masked).toBe(true)
    expect(tinyWomen.payPosition.womenShareOfMenMeanPct).toBeNull()
    expect(tinyWomen.payPosition.womenShareOfMenMedianPct).toBeNull()
  })

  it("counts the equal-work and equivalent-work measures from the statuses", () => {
    const signing = signingReportDoc(full())
    expect(signing.equalWork).toEqual({
      groups: 2,
      womenAhead: 0,
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
    })
    expect(signing.equivalentWork).toEqual({
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
    })
  })

  // The measures table prints "Groups compared" directly above a conclusion
  // that says both directions are counted, so the count has to cover both:
  // a women-ahead group was compared in exactly the sense the row names.
  it("counts women-ahead groups as compared without giving them a duty", () => {
    const withReverse = signingReportDoc(
      full({
        excluded: makeExcluded({
          reverse: [
            makeGapGroup({
              key: "Design|3",
              roleTitle: "Design",
              level: 3,
              womenCount: 4,
              menCount: 2,
              flag: "ok",
            }),
            // Under the per-gender floor: masked, so it also lands in the
            // insufficient-basis row.
            makeGapGroup({
              key: "Legal|2",
              roleTitle: "Legal",
              level: 2,
              womenCount: 3,
              menCount: 1,
              flag: "ok",
            }),
          ],
        }),
      })
    )
    const base = signingReportDoc(full())
    expect(withReverse.equalWork.groups).toBe(base.equalWork.groups + 2)
    expect(withReverse.equalWork.womenAhead).toBe(2)
    expect(withReverse.equalWork.insufficientBasis).toBe(
      base.equalWork.insufficientBasis + 1
    )
    // No duty travels with them: every duty-bearing measure is unchanged.
    expect(withReverse.equalWork.required).toBe(base.equalWork.required)
    expect(withReverse.equalWork.assessed).toBe(base.equalWork.assessed)
    expect(withReverse.equalWork.objectiveReasons).toBe(
      base.equalWork.objectiveReasons
    )
    expect(withReverse.equalWork.actionsDecided).toBe(
      base.equalWork.actionsDecided
    )
    expect(withReverse.equalWork.statuses).toEqual(base.equalWork.statuses)
  })

  // Equivalent-work completion is counted in COMPARISONS against the
  // relevant-comparisons figure it is printed beside, not in groups: the two
  // rows sit next to each other and the second reads as a subset of the first.
  it("reports equivalent-work completion in comparisons, against the same total", () => {
    const signing = signingReportDoc(full())
    expect(signing.equivalentWork.comparisonsAssessed).toBe(2)
    expect(signing.equivalentWork.comparisons).toBe(2)
    // The group's own klarmarkering is what a comparison's done state reads,
    // so dropping it takes both of its comparisons out of the numerator
    // while the denominator stays.
    const notDone = signingReportDoc(full({}, [], []))
    expect(notDone.equivalentWork.comparisonsAssessed).toBe(0)
    expect(notDone.equivalentWork.comparisons).toBe(2)
  })

  // A measure for a women-dominated group may be anchored on the group or on
  // one of its members; counting comparison targets alone reported no decided
  // measure while the action plan showed one for the same area.
  it.each([
    ["group", { kind: "group", scope: "equivalentWork", groupKey: "Nurse|2" }],
    [
      "person",
      {
        kind: "person",
        scope: "equivalentWork",
        groupKey: "Nurse|2",
        personPublicId: "p9",
      },
    ],
  ] as const)(
    "counts a %s-anchored equivalent-work measure as an action decided",
    (_kind, target) => {
      const base = signingReportDoc(full())
      const signing = signingReportDoc(
        full({}, [
          makeAction({
            actionId: "a4" as Id<"payMappingActions">,
            number: 4,
            target,
            estimatedCost: null,
            estimatedCostUnit: null,
          }),
        ])
      )
      expect(signing.equivalentWork.actionsDecided).toBe(
        base.equivalentWork.actionsDecided + 1
      )
    }
  )

  it("builds the practice table, the action plan per area and the checklist", () => {
    const signing = signingReportDoc(full())
    expect(
      signing.praxis.map((area) => [area.key, area.finding, area.done])
    ).toEqual([
      ["payPolicy", "found", true],
      ["collectiveAgreements", null, false],
      ["benefits", "none", true],
      ["payPractices", null, false],
    ])
    expect(signing.praxis[0]?.action).toEqual({
      number: 3,
      plannedAction: "Rewrite the pay policy",
      plannedDate: "D2000",
    })
    expect(signing.collaboration).toEqual({
      participants: "Union rep",
      description: "Monthly",
      date: "D4000",
      remarks: "The parties ask for a follow-up before the next mapping.",
    })
    expect(signing.actionPlan).toEqual([
      {
        area: "equalWork",
        observations: 1,
        count: 1,
        notStarted: 1,
        inProgress: 0,
        done: 0,
        cost: "M42000",
        earliest: "D1000",
        latest: "D1000",
      },
      {
        area: "equivalentWork",
        observations: 2,
        count: 1,
        notStarted: 0,
        inProgress: 1,
        done: 0,
        cost: "M500/perMonth",
        earliest: "D3000",
        latest: "D3000",
      },
      {
        area: "praxis",
        observations: 1,
        count: 1,
        notStarted: 1,
        inProgress: 0,
        done: 0,
        cost: null,
        earliest: "D2000",
        latest: "D2000",
      },
    ])
    expect(signing.checklist).toEqual({
      allRequiredAssessed: true,
      reasonsOrActionsLinked: true,
      collaborationDocumented: true,
      sameFrozenVersion: true,
    })
    expect(signing.openItems).toEqual({ openAnalyses: 0, actionsInProgress: 1 })
    expect(signing.exclusions).toEqual({
      withoutPay: 0,
      singletonCount: 0,
      genderPureCount: 0,
      maskedGroupCount: 2,
    })
  })
})

describe("detailAppendixDoc", () => {
  it("keeps every group with its figures", () => {
    const doc = full()
    const appendix = detailAppendixDoc(doc)
    expect(appendix.equalWork.map((group) => group.tcc.womenMean)).toEqual([
      "M90000",
      "M50000",
    ])
    expect(
      appendix.womenDominated[0]?.comparisons.map(
        (comparison) => comparison.diffKr
      )
    ).toEqual(["M5000", "M7000"])
    expect(appendix.method.criteria.map((criterion) => criterion.name)).toEqual(
      ["Knowledge", "Responsibility"]
    )
  })
})
