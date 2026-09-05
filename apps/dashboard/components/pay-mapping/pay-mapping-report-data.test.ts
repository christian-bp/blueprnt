import messages from "@workspace/i18n/messages/en.json"
import { createTranslator } from "next-intl"
import { describe, expect, it } from "vitest"
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
  PayMappingNoteWire,
  WomenDominatedGroupWire,
} from "./pay-mapping-gap-types"
import type { PayMappingSnapshotRow } from "./pay-mapping-gap-types"
import {
  assemblePayMappingReport,
  floorVariablePayStats,
  hourlyNoteLabel,
  orgVariablePayStats,
  type ReportFormatters,
} from "./pay-mapping-report-data"

const tReport = createTranslator({
  locale: "en",
  messages,
  namespace: "dashboard.payMapping.report",
})

// Marker formatters: assertions read the raw figure back out of the marker,
// so a wrong number and a missing formatting call both fail loudly.
const formatters: ReportFormatters = {
  money: (value) => `M${value}`,
  pct: (value) => `P${value}`,
  date: (epochMs) => `D${epochMs}`,
  dateTime: (epochMs) => `T${epochMs}`,
  year: (epochMs) => `Y${epochMs}`,
  costUnitSuffix: (unit) =>
    unit === null || unit === "oneOff" ? "" : `/${unit}`,
}

function makeWomenDominated(
  overrides: Partial<WomenDominatedGroupWire> = {}
): WomenDominatedGroupWire {
  return {
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
    ...overrides,
  }
}

function makeAction(
  overrides: Partial<PayMappingActionWire> = {}
): PayMappingActionWire {
  return {
    actionId: "a1" as PayMappingActionWire["actionId"],
    target: { kind: "group", scope: "equalWork", groupKey: "SWE|3|Senior" },
    number: 1,
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

describe("assemblePayMappingReport", () => {
  const analyses: GroupAnalysis[] = [
    {
      scope: "equalWork",
      groupKey: "SWE|3|Senior",
      comparisonKey: null,
      reasons: ["experience", "performance"],
      note: "Documented",
      done: true,
    },
    {
      scope: "equivalentWork",
      groupKey: "Nurse|2",
      comparisonKey: null,
      reasons: [],
      note: "Group summary",
      done: true,
    },
    {
      scope: "equivalentWork",
      groupKey: "Nurse|2",
      comparisonKey: "Support|3",
      reasons: ["historicalPay"],
      note: null,
      done: false,
    },
    {
      scope: "praxis",
      groupKey: "payPolicy",
      comparisonKey: null,
      reasons: [],
      note: "Policy reviewed",
      done: true,
      finding: "none",
    },
    {
      scope: "praxis",
      groupKey: "previousActions",
      comparisonKey: null,
      reasons: [],
      note: "All carried out",
      done: true,
      finding: "none",
    },
  ].map((row) => ({ finding: null, ...row }) as GroupAnalysis)

  function assemble(overrides: {
    withPrevious?: boolean
    completed?: boolean
    extraActions?: PayMappingActionWire[]
    collaborationDate?: number
  }) {
    return assemblePayMappingReport({
      run: makeRunDetail({
        status: overrides.completed ? "completed" : "active",
        collaboration: {
          participants: "Union rep",
          description: "Monthly",
          date: overrides.collaborationDate ?? null,
          remarks: null,
        },
        frozenMethod: {
          criteria: [
            makeFrozenCriterion({
              name: "Knowledge",
              weightPoints: 4,
              dimensionKey: "competence",
              purpose: "Depth of professional knowledge",
              whyRelevant: "The work turns on applied expertise",
              weightMotivation: "The heaviest demand in this organization",
            }),
            makeFrozenCriterion({
              name: "Responsibility",
              weightPoints: 2,
              dimensionKey: "responsibility",
            }),
          ],
          levelRules: [{ level: 1, minScore: 90 }],
          zoneProfileRules: [{ zone: "A", minStep: 4 }],
          workingConditions: {
            status: "testedNotMaterial",
            motivation: "Tested",
          },
          approvedAt: 1_700_000_000_000,
        },
        rows: [
          {
            personPublicId: "p1",
            displayName: "Anna",
            erased: false,
            gender: "Kvinna",
            roleTitle: "SWE",
            trackKey: "ic",
            seniority: "Senior",
            level: 3,
            basicMonthly: 45000,
            // The medians read total compensation: her bonus counts.
            components: [{ kind: "bonus", monthlyAmount: 5000 }],
          },
          {
            personPublicId: "p2",
            displayName: "Erik",
            erased: false,
            gender: "Man",
            roleTitle: "SWE",
            trackKey: "ic",
            seniority: "Senior",
            level: 3,
            basicMonthly: null,
            components: [],
          },
        ],
      }),
      gap: makeGapResult({
        equalWork: [
          makeGapGroup(),
          makeGapGroup({
            key: "QA|4",
            roleTitle: "QA",
            level: 4,
            womenCount: 1,
            menCount: 3,
            flag: "critical",
          }),
          // Unmasked this year, but 1W/1M in the PREVIOUS run: its
          // year-over-year figure must stay masked at the source.
          makeGapGroup({ key: "Dev|1", roleTitle: "Dev", level: 1 }),
        ],
        womenDominated: [
          makeWomenDominated(),
          // A 3-person dominated group: whole-group mean masks, and so does
          // its comparison's difference (it reads against the masked mean).
          makeWomenDominated({
            key: "Clerk|4",
            roleTitle: "Clerk",
            level: 4,
            headcount: 3,
          }),
        ],
        quartiles: [
          { women: 2, men: 0 },
          { women: 1, men: 1 },
          { women: 0, men: 1 },
          { women: 0, men: 2 },
        ],
        excluded: makeExcluded({
          singletonCount: 2,
          genderPure: [
            {
              key: "Lead|1",
              roleTitle: "Lead",
              seniority: null,
              level: 1,
              gender: "Man",
              count: 3,
            },
          ],
          reverse: [
            makeGapGroup({
              key: "UX|2",
              roleTitle: "UX",
              level: 2,
              flag: "ok",
              // Women ahead: the only negative figure in the fixture, so the
              // unsigned-amount rule is exercised in the direction that has
              // a sign to lose.
              metric: { gapPct: -8, gapKr: -3000 },
            }),
          ],
        }),
      }),
      analyses,
      actions: [
        makeAction(),
        makeAction({
          actionId: "a2" as PayMappingActionWire["actionId"],
          number: 2,
          target: {
            kind: "person",
            scope: "equalWork",
            groupKey: "SWE|3|Senior",
            personPublicId: "p1",
          },
          estimatedCost: null,
          status: "done",
        }),
        ...(overrides.extraActions ?? []),
      ],
      notes: [
        {
          noteId: "n1" as PayMappingNoteWire["noteId"],
          target: {
            kind: "comparison",
            groupKey: "Nurse|2",
            comparisonKey: "Support|3",
          },
          text: "Discuss next samverkan",
          noteType: "discussionNeeded",
          erased: false,
          createdBy: "u1",
          createdByName: "HR Person",
          createdAt: 2000,
        },
      ],
      previous: overrides.withPrevious
        ? {
            runLabel: "Pay mapping 2025",
            referenceDate: 500,
            actions: [makeAction({ status: "inProgress" })],
            gap: makeGapResult({
              equalWork: [
                // Year-over-year reads the primary measure (total comp),
                // never the base gap beside it.
                makeGapGroup({
                  base: { gapPct: 9, gapKr: 9000 },
                  tcc: { gapPct: 12, gapKr: 12000 },
                }),
                makeGapGroup({
                  key: "Dev|1",
                  roleTitle: "Dev",
                  level: 1,
                  womenCount: 1,
                  menCount: 1,
                  metric: { gapPct: 25, gapKr: 25000 },
                }),
              ],
            }),
          }
        : null,
      formatters,
      praxisAreaLabel: (area) => `Area ${area}`,
    })
  }

  it("keeps every group's figures and only FLAGS the export-threshold rows", () => {
    const doc = assemble({ withPrevious: true })
    const [swe, qa] = doc.equalWork
    expect(swe?.masked).toBe(false)
    expect(swe?.tcc.womenMean).toBe("M90000")
    expect(swe?.tcc.gapPct).toBe("P10")
    expect(swe?.reasons).toEqual(["experience", "performance"])
    expect(swe?.done).toBe(true)
    // 1 woman / 3 men: flagged for the signing projection, but the figures
    // are all there (the appendix prints them; masking is the projection's
    // business, never the assembly's).
    expect(qa?.masked).toBe(true)
    expect(qa?.tcc.womenMean).toBe("M90000")
    expect(qa?.tcc.gapPct).toBe("P10")
    expect(qa?.base.womenMean).toBe("M90000")
    // Two distinct groups carry the flag: QA (1 woman / 3 men) and the
    // 3-person Clerk group, whose whole-group mean sits under the floor.
    expect(doc.method.maskedGroupCount).toBe(2)
  })

  it("keeps whole-group means in the women-dominated comparison and flags by total headcount", () => {
    const doc = assemble({ withPrevious: true })
    const [nurse, clerk] = doc.womenDominated
    expect(nurse?.masked).toBe(false)
    expect(nurse?.meanComp).toBe("M40000")
    expect(nurse?.comparisons[0]?.diffKr).toBe("M5000")
    expect(nurse?.comparisons[0]?.reasons).toEqual(["historicalPay"])
    expect(clerk?.masked).toBe(true)
    // The clerk fixture overrides only key, title, level and headcount, so
    // its mean is makeWomenDominated's default.
    expect(clerk?.meanComp).toBe("M40000")
    expect(clerk?.comparisons[0]?.masked).toBe(true)
    expect(clerk?.comparisons[0]?.diffKr).toBe("M5000")
  })

  it("assembles the statutory sections: praxis, samverkan, actions, evaluation", () => {
    const doc = assemble({ withPrevious: true, completed: true })
    expect(doc.status).toBe("final")
    expect(doc.collaboration).toEqual({
      participants: "Union rep",
      description: "Monthly",
      date: null,
      remarks: null,
    })
    // Base areas only: previousActions renders as the evaluation section.
    expect(doc.praxis.map((row) => row.key)).toEqual([
      "payPolicy",
      "collectiveAgreements",
      "benefits",
      "payPractices",
    ])
    expect(doc.praxis[0]?.finding).toBe("none")
    expect(doc.praxis[1]?.finding).toBeNull()
    expect(doc.actionTotals).toEqual({
      count: 2,
      cost: "M42000",
      notStarted: 1,
      inProgress: 0,
      done: 1,
    })
    // A person-targeted action reads by its GROUP, never a name.
    expect(doc.actions[1]?.label).toBe("SWE")
    expect(doc.previousEvaluation?.runLabel).toBe("Pay mapping 2025")
    expect(doc.previousEvaluation?.note).toBe("All carried out")
    expect(doc.previousEvaluation?.actions[0]?.status).toBe("inProgress")
    expect(doc.population).toEqual({
      total: 6,
      women: 3,
      men: 3,
      priced: 1,
      womenPriced: 1,
      menPriced: 0,
    })
  })

  it("derives a status and the linked actions for every group and comparison", () => {
    const doc = assemble({ withPrevious: true })
    const [swe, qa] = doc.equalWork
    // SWE: done with reasons, but two actions (one on the group, one on a
    // member) target it, so the action wins and both are cited.
    expect(swe?.status).toBe("actionDecided")
    expect(swe?.actions).toEqual([
      { number: 1, ownerName: "HR Person", plannedDate: "D1000" },
      { number: 2, ownerName: "HR Person", plannedDate: "D1000" },
    ])
    // QA: flagged, nothing documented, no action.
    expect(qa?.status).toBe("furtherAnalysis")
    expect(qa?.actions).toEqual([])
    // The reverse list carries no duty.
    expect(doc.reverseGroups[0]?.status).toBe("noActionNeeded")
    const [nurse] = doc.womenDominated
    expect(nurse?.actions).toEqual([])
    expect(nurse?.comparisons[0]?.status).toBe("objectiveReason")
    expect(nurse?.comparisons[0]?.actions).toEqual([])
    // The women-dominated group carries its OWN status too: a measure for it
    // may be anchored on the group or on a member rather than on a single
    // comparison, and no comparison row could report that.
    expect(nurse?.status).toBe("objectiveReason")
  })

  it("reports a group-anchored equivalent-work measure on the group's own status", () => {
    const doc = assemble({
      withPrevious: true,
      extraActions: [
        makeAction({
          actionId: "a8" as PayMappingActionWire["actionId"],
          number: 8,
          target: {
            kind: "group",
            scope: "equivalentWork",
            groupKey: "Nurse|2",
          },
        }),
      ],
    })
    const [nurse] = doc.womenDominated
    expect(nurse?.status).toBe("actionDecided")
    // The comparison rows are untouched: they read comparison targets only.
    expect(nurse?.comparisons[0]?.status).toBe("objectiveReason")
  })

  it("joins a praxis action to its area and carries the collaboration date", () => {
    const doc = assemble({
      withPrevious: false,
      extraActions: [
        makeAction({
          actionId: "a9" as PayMappingActionWire["actionId"],
          number: 9,
          target: { kind: "praxis", area: "payPolicy" },
          plannedAction: "Rewrite the pay policy",
          plannedDate: 5000,
        }),
      ],
      collaborationDate: 7000,
    })
    expect(doc.praxis[0]?.action).toEqual({
      number: 9,
      plannedAction: "Rewrite the pay policy",
      plannedDate: "D5000",
    })
    expect(doc.praxis[1]?.action).toBeNull()
    expect(doc.collaboration?.date).toBe("D7000")
    const praxisRow = doc.actions.find((a) => a.kind === "praxis")
    expect(praxisRow?.scope).toBe("praxis")
    expect(praxisRow?.label).toBe("Area payPolicy")
    expect(praxisRow?.number).toBe(9)
    expect(praxisRow?.plannedDateMs).toBe(5000)
  })

  it("carries the identity block's raw parts and the frozen method in full", () => {
    const doc = assemble({ withPrevious: false })
    expect(doc.previousEvaluation).toBeNull()
    expect(doc.method.pointBudget).toBe(6)
    expect(doc.identity).toEqual({
      approvedAt: "D1700000000000",
      referenceDate: `D${Date.UTC(2026, 6, 1)}`,
      extractedAt: `T${Date.UTC(2026, 6, 1)}`,
      year: `Y${Date.UTC(2026, 6, 1)}`,
    })
    // The frozen criterion documentation travels with the weights: the
    // appendix has to stand alone, so it prints what each criterion measures
    // rather than pointing at the live model.
    expect(doc.method.criteria).toEqual([
      {
        name: "Knowledge",
        dimensionKey: "competence",
        weightPoints: 4,
        sharePct: "P66.66666666666666",
        purpose: "Depth of professional knowledge",
        whyRelevant: "The work turns on applied expertise",
        weightMotivation: "The heaviest demand in this organization",
      },
      {
        name: "Responsibility",
        dimensionKey: "responsibility",
        weightPoints: 2,
        sharePct: "P33.33333333333333",
        purpose: null,
        whyRelevant: null,
        weightMotivation: null,
      },
    ])
    expect(doc.method.dimensionShares).toEqual([
      { dimensionKey: "competence", sharePct: "P66.66666666666666" },
      { dimensionKey: "responsibility", sharePct: "P33.33333333333333" },
    ])
    expect(doc.method.levelRules).toEqual([{ level: 1, minScore: 90 }])
    expect(doc.method.zoneProfileRules).toEqual([{ zone: "A", minStep: 4 }])
    expect(doc.method.workingConditions).toEqual({
      status: "testedNotMaterial",
      motivation: "Tested",
    })
    expect(doc.method.approvedAt).toBe("D1700000000000")
    expect(doc.population.womenPriced).toBe(1)
    expect(doc.population.menPriced).toBe(0)
  })

  it("carries raw cost parts on every action row and one roll-up per scope", () => {
    const doc = assemble({})
    const group = doc.actions.find((a) => a.kind === "group")
    expect(group?.costAmount).toBe(42000)
    expect(group?.costUnit).toBe("oneOff")
    expect(group?.plannedDateMs).toBe(1000)
    expect(doc.actionCostByScope).toEqual({
      equalWork: "M42000",
      equivalentWork: null,
      praxis: null,
    })
    expect(doc.actionTotals.cost).toBe("M42000")
  })

  // The method note's conversion-factor line: hourlyRowCount covers every
  // priced hourly row, ownHoursCount only those whose hoursPerMonth differs
  // from the run's full-time default.
  it("counts hourly-paid rows and those with their own hours for the method note", () => {
    const hourlyRow = (
      overrides: Partial<PayMappingSnapshotRow>
    ): PayMappingSnapshotRow => ({
      personPublicId: "p1",
      displayName: "Anna",
      erased: false,
      gender: "Kvinna",
      roleTitle: "SWE",
      trackKey: "ic",
      seniority: "Senior",
      level: 3,
      basicMonthly: 30000,
      components: [],
      basis: "hourly",
      basicAmount: 200,
      hoursPerMonth: 150,
      ...overrides,
    })
    const doc = assemblePayMappingReport({
      run: makeRunDetail({
        fullTimeHoursDefault: 165,
        rows: [
          hourlyRow({ personPublicId: "p1", hoursPerMonth: 150 }),
          hourlyRow({ personPublicId: "p2", hoursPerMonth: 165 }),
        ],
      }),
      gap: makeGapResult(),
      analyses: [],
      actions: [],
      notes: [],
      previous: null,
      formatters,
      praxisAreaLabel: (area) => `Area ${area}`,
    })
    expect(doc.method.hourlyRowCount).toBe(2)
    expect(doc.method.ownHoursCount).toBe(1)
    expect(doc.fullTimeHoursDefault).toBe(165)
  })

  it("assembles no hourly rows for a run with none", () => {
    const doc = assemblePayMappingReport({
      run: makeRunDetail({ fullTimeHoursDefault: 165 }),
      gap: makeGapResult(),
      analyses: [],
      actions: [],
      notes: [],
      previous: null,
      formatters,
      praxisAreaLabel: (area) => `Area ${area}`,
    })
    expect(doc.method.hourlyRowCount).toBe(0)
  })

  it("hourlyNoteLabel is null when the run has no hourly rows", () => {
    const doc = assemblePayMappingReport({
      run: makeRunDetail({ fullTimeHoursDefault: 165 }),
      gap: makeGapResult(),
      analyses: [],
      actions: [],
      notes: [],
      previous: null,
      formatters,
      praxisAreaLabel: (area) => `Area ${area}`,
    })
    expect(doc.method.hourlyRowCount).toBe(0)
    expect(hourlyNoteLabel(doc, tReport)).toBeNull()
  })

  it("hourlyNoteLabel names the run's full-time hours default and the own-hours count, through the real en catalog", () => {
    const hourlyRow = (
      overrides: Partial<PayMappingSnapshotRow>
    ): PayMappingSnapshotRow => ({
      personPublicId: "p1",
      displayName: "Anna",
      erased: false,
      gender: "Kvinna",
      roleTitle: "SWE",
      trackKey: "ic",
      seniority: "Senior",
      level: 3,
      basicMonthly: 30000,
      components: [],
      basis: "hourly",
      basicAmount: 200,
      hoursPerMonth: 150,
      ...overrides,
    })
    const doc = assemblePayMappingReport({
      run: makeRunDetail({
        fullTimeHoursDefault: 165,
        rows: [
          hourlyRow({ personPublicId: "p1", hoursPerMonth: 150 }),
          hourlyRow({ personPublicId: "p2", hoursPerMonth: 165 }),
        ],
      }),
      gap: makeGapResult(),
      analyses: [],
      actions: [],
      notes: [],
      previous: null,
      formatters,
      praxisAreaLabel: (area) => `Area ${area}`,
    })
    expect(doc.method.hourlyRowCount).toBe(2)
    expect(doc.method.ownHoursCount).toBe(1)
    expect(hourlyNoteLabel(doc, tReport)).toBe(
      "Hourly pay is converted to full-time-equivalent monthly pay using 165 full-time hours per month (1 person with a value of their own)."
    )
  })

  it("carries medians, year-over-year figures and the excluded lists, unmasked", () => {
    const doc = assemble({ withPrevious: true })
    const swe = doc.equalWork[0]
    // Median computed from the frozen rows through the shared engine stats,
    // on total compensation: one priced woman at 45000 + 5000 bonus, no
    // priced man.
    expect(swe?.tccMedian.women).toBe("M50000")
    expect(swe?.tccMedian.men).toBeNull()
    // The previous run had the same group at a 12% mean gap.
    expect(swe?.previousGapPct).toBe("P12")
    // The previous run's Dev group was 1W/1M: the assembly carries its gap
    // anyway (the signing projection decides what leaves).
    const dev = doc.equalWork[2]
    expect(dev?.masked).toBe(false)
    expect(dev?.previousGapPct).toBe("P25")
    // A flagged row keeps its medians; absent figures are null for absence,
    // never for size (QA has no priced rows in this fixture, and no previous
    // group).
    const qa = doc.equalWork[1]
    expect(qa?.masked).toBe(true)
    expect(qa?.tccMedian.women).toBeNull()
    expect(qa?.previousGapPct).toBeNull()
    // The excluded groups are listed by identity, not only counted.
    expect(doc.reverseGroups.map((group) => group.key)).toEqual(["UX|2"])
    expect(doc.genderPureGroups).toEqual([
      {
        key: "Lead|1",
        label: "Lead",
        level: 1,
        gender: "Man",
        count: 3,
      },
    ])
    expect(doc.method.singletonCount).toBe(2)
  })

  it("keeps every table unsigned", () => {
    const doc = assemble({})
    // Direction is carried by the section split (the women-ahead list),
    // never by a sign.
    expect(doc.equalWork[0]?.tcc.gapPct).toBe("P10")
    expect(doc.equalWork[0]?.tcc.gapKr).toBe("M10000")
    // The women-ahead row's amount loses its sign; the percent carries the
    // wire figure the section already frames.
    expect(doc.reverseGroups[0]?.tcc.gapKr).toBe("M3000")
    expect(doc.reverseGroups[0]?.tcc.gapPct).toBe("P-8")
  })

  it("derives the summary key figures from the sections they summarize", () => {
    const doc = assemble({})
    // 90000 / 100000 from the org aggregate, formatted as a percent.
    expect(doc.summary.womenShareOfMenMeanPct).toBe("P90")
    // No priced men in this fixture (Erik's basicMonthly is null): a share
    // against men needs a men figure, which is null here, not masked.
    expect(doc.summary.womenShareOfMenMedianPct).toBeNull()
  })

  it("orgVariablePayStats: shares over everyone, amounts among receivers, unmasked", () => {
    const row = (
      index: number,
      gender: "Kvinna" | "Man",
      bonus: number
    ): PayMappingSnapshotRow => ({
      personPublicId: `p${gender}${index}`,
      displayName: `Person ${index}`,
      erased: false,
      gender,
      roleTitle: "SWE",
      trackKey: "ic",
      seniority: "Senior",
      level: 3,
      basicMonthly: 40000,
      components: bonus === 0 ? [] : [{ kind: "bonus", monthlyAmount: bonus }],
    })
    const stats = orgVariablePayStats([
      // Three of five women receive; the export floor is the signing
      // projection's job, not this assembly's (ADR-0030).
      row(0, "Kvinna", 2000),
      row(1, "Kvinna", 2000),
      row(2, "Kvinna", 2000),
      row(3, "Kvinna", 0),
      row(4, "Kvinna", 0),
      // Four of five men receive.
      row(5, "Man", 1000),
      row(6, "Man", 1000),
      row(7, "Man", 1000),
      row(8, "Man", 1000),
      row(9, "Man", 0),
    ])
    expect(stats.womenSharePct).toBe(60)
    expect(stats.menSharePct).toBe(80)
    expect(stats.womenMean).toBe(2000)
    expect(stats.womenMedian).toBe(2000)
    expect(stats.menMean).toBe(1000)
    expect(stats.menMedian).toBe(1000)
    // The counts a floor needs ride along with the raw figures.
    expect(stats.womenPriced).toBe(5)
    expect(stats.womenReceivers).toBe(3)
    expect(stats.menPriced).toBe(5)
    expect(stats.menReceivers).toBe(4)
  })

  it("floorVariablePayStats: drops a gender under the priced floor, its amounts under the receiver floor, and keeps the rest", () => {
    const raw = {
      womenPriced: 3,
      menPriced: 5,
      womenReceivers: 3,
      menReceivers: 4,
      womenSharePct: 100,
      menSharePct: 80,
      womenMean: 2000,
      menMean: 1000,
      womenMedian: 2000,
      menMedian: 1000,
    }
    // Women: three priced people, under the group minimum: every figure goes.
    // Men: five priced, four receivers, at the minimum: unchanged.
    expect(floorVariablePayStats(raw)).toEqual({
      ...raw,
      womenSharePct: null,
      womenMean: null,
      womenMedian: null,
    })
    // Under the receiver floor only: the share stays, the amounts go.
    expect(
      floorVariablePayStats({ ...raw, womenPriced: 5, womenReceivers: 3 })
    ).toEqual({
      ...raw,
      womenPriced: 5,
      womenMean: null,
      womenMedian: null,
    })
    // The raw stats are not mutated.
    expect(raw.womenMean).toBe(2000)
  })

  it("orgVariablePayStats: null only when a gender has no priced rows or no receivers", () => {
    const row = (
      index: number,
      gender: "Kvinna" | "Man",
      bonus: number
    ): PayMappingSnapshotRow => ({
      personPublicId: `p${gender}${index}`,
      displayName: `Person ${index}`,
      erased: false,
      gender,
      roleTitle: "SWE",
      trackKey: "ic",
      seniority: "Senior",
      level: 3,
      basicMonthly: 40000,
      components: bonus === 0 ? [] : [{ kind: "bonus", monthlyAmount: bonus }],
    })
    const stats = orgVariablePayStats([
      // No women at all: sharePct and amounts all null.
      // Two men, neither receiving: sharePct is a real 0, amounts null.
      row(0, "Man", 0),
      row(1, "Man", 0),
    ])
    expect(stats.womenSharePct).toBeNull()
    expect(stats.womenMean).toBeNull()
    expect(stats.womenMedian).toBeNull()
    expect(stats.menSharePct).toBe(0)
    expect(stats.menMean).toBeNull()
    expect(stats.menMedian).toBeNull()
  })
})
