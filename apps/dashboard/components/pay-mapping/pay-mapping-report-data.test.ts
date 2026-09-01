import { describe, expect, it } from "vitest"
import {
  makeExcluded,
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
  computeHeaderBreaks,
  exportMasksGenderMeans,
  exportMasksWholeGroupMean,
  orgVariablePayStats,
  type ReportFormatters,
  unionReportDoc,
} from "./pay-mapping-report-data"

// Marker formatters: assertions read the raw figure back out of the marker,
// so a wrong number and a missing formatting call both fail loudly. The
// signed marker keeps the raw sign, so a signed cell reads S-8 for a level
// where women are ahead.
const formatters: ReportFormatters = {
  money: (value) => `M${value}`,
  pct: (value) => `P${value}`,
  signedPct: (value) => `S${value}`,
  date: (epochMs) => `D${epochMs}`,
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

describe("export-boundary masking (ADR-0012)", () => {
  it("masks per-gender means below the small-cell minimums", () => {
    expect(exportMasksGenderMeans({ womenCount: 2, menCount: 2 })).toBe(false)
    // 1 woman: her "mean" is her salary.
    expect(exportMasksGenderMeans({ womenCount: 1, menCount: 3 })).toBe(true)
    expect(exportMasksGenderMeans({ womenCount: 3, menCount: 1 })).toBe(true)
    // Fewer than 4 in total masks even at 2 per gender by the rule's letter
    // (unreachable with integers, but the rule is stated as OR).
    expect(exportMasksGenderMeans({ womenCount: 2, menCount: 1 })).toBe(true)
  })

  it("masks a whole-group mean only below the total minimum", () => {
    expect(exportMasksWholeGroupMean(4)).toBe(false)
    expect(exportMasksWholeGroupMean(3)).toBe(true)
  })
})

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
  }) {
    return assemblePayMappingReport({
      run: makeRunDetail({
        status: overrides.completed ? "completed" : "active",
        collaboration: { participants: "Union rep", description: "Monthly" },
        frozenCriteria: [
          { name: "Knowledge", weightPoints: 4 },
          { name: "Responsibility", weightPoints: 2 },
        ],
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
            components: [],
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
        // One per-level bucket below the per-gender minimums: it renders
        // masked dashes in the report's per-level table, so the stated
        // masked-group count must include it.
        equivalentWork: [
          makeGapGroup({
            key: "2",
            roleTitle: null,
            level: 2,
            womenCount: 1,
            menCount: 1,
            flag: "insufficient",
          }),
          // A level where WOMEN are ahead: the wire builds the per-level
          // table in both directions, so its figures must render signed.
          makeGapGroup({
            key: "3",
            roleTitle: null,
            level: 3,
            flag: "ok",
            metric: { gapPct: -8, gapKr: -3000 },
          }),
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
            }),
          ],
        }),
      }),
      analyses,
      actions: [
        makeAction(),
        makeAction({
          actionId: "a2" as PayMappingActionWire["actionId"],
          target: {
            kind: "person",
            scope: "equalWork",
            groupKey: "SWE|3",
            personPublicId: "p1",
          },
          estimatedCost: null,
          status: "done",
        }),
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
                makeGapGroup({ metric: { gapPct: 12, gapKr: 12000 } }),
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
    })
  }

  it("keeps figures for compliant groups and masks small cells", () => {
    const doc = assemble({ withPrevious: true })
    const [swe, qa] = doc.equalWork
    expect(swe?.masked).toBe(false)
    expect(swe?.base.womenMean).toBe("M90000")
    expect(swe?.base.gapPct).toBe("P10")
    expect(swe?.reasons).toEqual(["experience", "performance"])
    expect(swe?.done).toBe(true)
    // 1 woman / 3 men: in-app shows the figures, the export masks them.
    expect(qa?.masked).toBe(true)
    expect(qa?.base.womenMean).toBeNull()
    expect(qa?.base.gapPct).toBeNull()
    // QA (per-gender), level 2 (per-gender, per-level table) and the
    // 3-person Clerk group (whole-group), counted as distinct group keys.
    expect(doc.method.maskedGroupCount).toBe(3)
  })

  it("masks whole-group means by total headcount in the women-dominated comparison", () => {
    const doc = assemble({ withPrevious: true })
    const [nurse, clerk] = doc.womenDominated
    expect(nurse?.meanComp).toBe("M40000")
    expect(nurse?.comparisons[0]?.diffKr).toBe("M5000")
    expect(nurse?.comparisons[0]?.reasons).toEqual(["historicalPay"])
    expect(clerk?.meanComp).toBeNull()
    // The comparator has 4 people, but the difference reads against the
    // masked dominated mean, so it masks too.
    expect(clerk?.comparisons[0]?.diffKr).toBeNull()
  })

  it("assembles the statutory sections: praxis, samverkan, actions, evaluation", () => {
    const doc = assemble({ withPrevious: true, completed: true })
    expect(doc.status).toBe("final")
    expect(doc.collaboration).toEqual({
      participants: "Union rep",
      description: "Monthly",
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
    expect(doc.population).toEqual({ total: 6, women: 3, men: 3, priced: 1 })
  })

  it("derives the method section from the frozen criteria", () => {
    const doc = assemble({ withPrevious: false })
    expect(doc.previousEvaluation).toBeNull()
    expect(doc.method.pointBudget).toBe(6)
    expect(doc.method.criteria).toEqual([
      { name: "Knowledge", weightPoints: 4, sharePct: `P${(4 / 6) * 100}` },
      {
        name: "Responsibility",
        weightPoints: 2,
        sharePct: `P${(2 / 6) * 100}`,
      },
    ])
  })

  it("carries medians, year-over-year figures, spread and the excluded lists", () => {
    const doc = assemble({ withPrevious: true })
    const swe = doc.equalWork[0]
    // Median computed from the frozen rows through the shared engine stats:
    // one priced woman at 45000, no priced man.
    expect(swe?.baseMedian.women).toBe("M45000")
    expect(swe?.baseMedian.men).toBeNull()
    // The previous run had the same group at a 12% mean gap.
    expect(swe?.previousGapPct).toBe("P12")
    // The previous run's Dev group was 1W/1M: its gap is masked at the
    // source and must not leak now that the group is above the minimums.
    const dev = doc.equalWork[2]
    expect(dev?.masked).toBe(false)
    expect(dev?.previousGapPct).toBeNull()
    // A masked row masks its medians and its year-over-year figure too.
    const qa = doc.equalWork[1]
    expect(qa?.baseMedian.women).toBeNull()
    expect(qa?.previousGapPct).toBeNull()
    // Org-level year-over-year line from the previous gap aggregate.
    expect(doc.orgPrevious).toEqual({
      runLabel: "Pay mapping 2025",
      referenceDate: "D500",
      gapPct: "P10",
    })
    // Charts read raw numbers mirroring the formatted org means.
    expect(doc.chartData.means).toEqual({ women: 90000, men: 100000 })
    // One priced woman and no priced men: both genders sit under the
    // population-spread minimum and mask.
    expect(doc.spread.women).toBeNull()
    expect(doc.spread.men).toBeNull()
    expect(doc.chartData.spread.women).toBeNull()
    // The org medians follow the population-spread floor, so they mask with
    // it and can never print a value the spread table dashes.
    expect(doc.org.womenMedian).toBeNull()
    expect(doc.org.menMedian).toBeNull()
    expect(doc.org.medianGapPct).toBeNull()
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

  it("signs the per-level table's figures and keeps the other tables unsigned", () => {
    const doc = assemble({})
    // The reversed level keeps its minus in both the percent and the amount:
    // the per-level table runs in both directions, so an unsigned figure
    // would render a level where women are ahead identically to one where
    // they are behind.
    const reversed = doc.equivalentWorkLevels.find((row) => row.key === "3")
    expect(reversed?.base.gapPct).toBe("S-8")
    expect(reversed?.base.gapKr).toBe("M-3000")
    // Equal work stays unsigned: direction is carried by the section split
    // (the women-ahead list), never by a sign.
    expect(doc.equalWork[0]?.base.gapPct).toBe("P10")
  })

  it("derives the summary key figures from the sections they summarize", () => {
    const doc = assemble({})
    expect(doc.summary.equalWorkGroups).toBe(3)
    // SWE and Dev are elevated, QA critical: all three require reasons.
    expect(doc.summary.equalWorkRequired).toBe(3)
    // Only SWE's analysis row is marked done.
    expect(doc.summary.equalWorkDocumented).toBe(1)
    expect(doc.summary.womenDominatedGroups).toBe(2)
    expect(doc.summary.comparisonCount).toBe(2)
    // Only the Nurse group's comparison carries reasons.
    expect(doc.summary.comparisonsDocumented).toBe(1)
    // 90000 / 100000 from the org aggregate, formatted as a percent.
    expect(doc.summary.womenShareOfMenMeanPct).toBe("P90")
    // The median share follows the population-spread masking floor.
    expect(doc.summary.womenShareOfMenMedianPct).toBeNull()
    // One priced woman and no priced men: every variable-pay figure sits
    // under the per-gender floor and masks.
    expect(doc.summary.variableShareWomenPct).toBeNull()
    expect(doc.summary.variableShareMenPct).toBeNull()
    expect(doc.summary.variableWomenShareOfMenMeanPct).toBeNull()
    expect(doc.summary.variableWomenShareOfMenMedianPct).toBeNull()
  })

  it("orgVariablePayStats: shares over everyone, amounts among receivers, floors per gender", () => {
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
      // Three of five women receive (below the 4-receiver floor).
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
    expect(stats.womenMean).toBeNull()
    expect(stats.womenMedian).toBeNull()
    expect(stats.menMean).toBe(1000)
    expect(stats.menMedian).toBe(1000)
  })

  it("computeHeaderBreaks marks rows that start a later page, never a table's first row", () => {
    const doc = assemble({ withPrevious: true })
    const breaks = computeHeaderBreaks(doc, {
      // Equal work: the second row lands on a new page.
      "equalWork:SWE|3|Senior": 5,
      "equalWork:QA|4": 6,
      "equalWork:Dev|1": 6,
      // The women-dominated tables are tracked per group: a page step
      // inside one group's list breaks there.
      "wd:Nurse|2:Support|3": 7,
      "wd:Clerk|4:Support|3": 8,
      // Actions stay on one page: no break.
      "actions:a1": 9,
      "actions:a2": 9,
    })
    expect(breaks.has("equalWork:QA|4")).toBe(true)
    // A later row on the SAME page as the break row adds no second header.
    expect(breaks.has("equalWork:Dev|1")).toBe(false)
    // A table's first row never breaks (there is nothing above it to
    // continue from), and separate wd groups are separate tables.
    expect(breaks.has("equalWork:SWE|3|Senior")).toBe(false)
    expect(breaks.has("wd:Nurse|2:Support|3")).toBe(false)
    expect(breaks.has("wd:Clerk|4:Support|3")).toBe(false)
    expect(breaks.has("actions:a2")).toBe(false)
    expect(breaks.size).toBe(1)
  })

  it("computeHeaderBreaks skips rows with no reported page", () => {
    const doc = assemble({})
    // A partial measurement (a row that never reported) must not fabricate
    // a break from the gap in the sequence.
    const breaks = computeHeaderBreaks(doc, {
      "equalWork:SWE|3|Senior": 5,
      "equalWork:Dev|1": 5,
    })
    expect(breaks.size).toBe(0)
  })

  // The union variant's data-level masking (kravbild
  // docs/lonekartlaggning-facklig-rapport-kravbild.md §5): individual-adjacent
  // details leave the doc, the group-level statutory content stays.
  it("masks person-targeted action costs, drops notes, keeps everything else", () => {
    const doc = assemble({})
    // The fixture's person action carries no cost; give every row one so the
    // per-kind masking is observable.
    const withCosts = {
      ...doc,
      actions: doc.actions.map((action) => ({ ...action, cost: "10 000 kr" })),
    }
    const union = unionReportDoc(withCosts)

    const group = union.actions.find((action) => action.kind === "group")
    const person = union.actions.find((action) => action.kind === "person")
    expect(group?.cost).toBe("10 000 kr")
    // A person-targeted cost is in practice that individual's planned
    // adjustment: masked per row, carried only by the roll-up.
    expect(person?.cost).toBeNull()
    expect(union.actionTotals).toEqual(withCosts.actionTotals)

    // Internal working notes never enter the union document.
    expect(doc.notes.length).toBeGreaterThan(0)
    expect(union.notes).toEqual([])

    // The statutory group-level content is untouched.
    expect(union.equalWork).toEqual(doc.equalWork)
    expect(union.summary).toEqual(doc.summary)
    expect(union.collaboration).toEqual(doc.collaboration)
  })

  it("masks the previous year's person-targeted costs by the same rule", () => {
    const doc = assemble({ withPrevious: true })
    const previous = doc.previousEvaluation
    expect(previous).not.toBeNull()
    if (previous === null) throw new Error("unreachable")
    const base = previous.actions[0]
    if (base === undefined) throw new Error("unreachable")
    // The fixture's prior action is group-targeted; recast one row per kind
    // with a cost so the per-kind rule is observable in the OTHER table too
    // (last year's person cost is still an individual's adjustment).
    const withKinds = {
      ...doc,
      previousEvaluation: {
        ...previous,
        actions: [
          { ...base, kind: "group" as const, cost: "M1000" },
          {
            ...base,
            id: "prev-person",
            kind: "person" as const,
            cost: "M2000",
          },
        ],
      },
    }
    const union = unionReportDoc(withKinds)
    expect(union.previousEvaluation?.actions[0]?.cost).toBe("M1000")
    expect(union.previousEvaluation?.actions[1]?.cost).toBeNull()
  })
})
