import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { describe, expect, it } from "vitest"
import { makeGapGroup } from "@/test/pay-mapping-fixtures"
import {
  ANALYSIS_STATUSES,
  type AnalysisStatus,
  analysisStatus,
  comparisonStatus,
  countByStatus,
  equalWorkGroupStatus,
  womenDominatedGroupStatus,
} from "./analysis-status"
import type {
  GroupAnalysis,
  PayMappingActionWire,
} from "./pay-mapping-gap-types"

function makeAction(
  target: PayMappingActionWire["target"],
  erased = false
): PayMappingActionWire {
  return {
    actionId: "a1" as Id<"payMappingActions">,
    number: 1,
    target,
    problem: erased ? "" : "Gap",
    plannedAction: erased ? "" : "Review",
    reason: null,
    ownerUserId: "u1",
    ownerName: "HR",
    plannedDate: 1,
    estimatedCost: null,
    estimatedCostUnit: null,
    priority: "medium",
    status: "notStarted",
    erased,
    createdAt: 1,
  }
}

// The rule, restated independently of the implementation: an action wins,
// then no duty, then a done and documented row, else open.
function expected(input: {
  required: boolean
  done: boolean
  reasons: boolean
  note: boolean
  action: boolean
}): AnalysisStatus {
  if (input.action) return "actionDecided"
  if (!input.required) return "noActionNeeded"
  if (input.done && (input.reasons || input.note)) return "objectiveReason"
  return "furtherAnalysis"
}

describe("analysisStatus", () => {
  it("derives every combination of required, done, reasons, note and action", () => {
    const flags = [false, true]
    for (const required of flags) {
      for (const done of flags) {
        for (const reasons of flags) {
          for (const note of flags) {
            for (const action of flags) {
              const status = analysisStatus({
                required,
                done,
                reasons: reasons ? ["experience"] : [],
                note: note ? "Looked into it" : null,
                hasAction: action,
              })
              expect(
                status,
                JSON.stringify({ required, done, reasons, note, action })
              ).toBe(expected({ required, done, reasons, note, action }))
            }
          }
        }
      }
    }
  })

  it("treats a whitespace-only note as no note", () => {
    expect(
      analysisStatus({
        required: true,
        done: true,
        reasons: [],
        note: "   ",
        hasAction: false,
      })
    ).toBe("furtherAnalysis")
  })
})

describe("the wire adapters", () => {
  const analyses: GroupAnalysis[] = [
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
  ]

  it("reads an equal-work group's duty from its flag and its documentation from its own row", () => {
    expect(
      equalWorkGroupStatus(
        makeGapGroup({ key: "SWE|3", flag: "elevated" }),
        analyses,
        []
      )
    ).toBe("objectiveReason")
    expect(
      equalWorkGroupStatus(makeGapGroup({ key: "QA|4", flag: "ok" }), [], [])
    ).toBe("noActionNeeded")
    expect(
      equalWorkGroupStatus(
        makeGapGroup({ key: "QA|4", flag: "critical" }),
        [],
        []
      )
    ).toBe("furtherAnalysis")
  })

  it("lets a non-erased action on the group, a member, or the comparison win, and ignores an erased one", () => {
    const group = makeGapGroup({ key: "SWE|3", flag: "elevated" })
    expect(
      equalWorkGroupStatus(group, analyses, [
        makeAction({ kind: "group", scope: "equalWork", groupKey: "SWE|3" }),
      ])
    ).toBe("actionDecided")
    expect(
      equalWorkGroupStatus(group, analyses, [
        makeAction({
          kind: "person",
          scope: "equalWork",
          groupKey: "SWE|3",
          personPublicId: "p1",
        }),
      ])
    ).toBe("actionDecided")
    expect(
      equalWorkGroupStatus(group, analyses, [
        makeAction(
          { kind: "group", scope: "equalWork", groupKey: "SWE|3" },
          true
        ),
      ])
    ).toBe("objectiveReason")
    expect(
      comparisonStatus({ key: "Nurse|2" }, "Support|3", analyses, [
        makeAction({
          kind: "comparison",
          groupKey: "Nurse|2",
          comparisonKey: "Support|3",
        }),
      ])
    ).toBe("actionDecided")
  })

  it("reads a comparison's done state from the group's own row and its reasons from the comparison row", () => {
    expect(
      comparisonStatus({ key: "Nurse|2" }, "Support|3", analyses, [])
    ).toBe("objectiveReason")
    expect(comparisonStatus({ key: "Nurse|2" }, "Clerk|3", analyses, [])).toBe(
      "furtherAnalysis"
    )
  })

  it("gives a women-dominated group with no comparisons no duty", () => {
    expect(
      womenDominatedGroupStatus(
        { key: "Nurse|2", comparisons: [] },
        analyses,
        []
      )
    ).toBe("noActionNeeded")
  })

  it("counts every status, zero included", () => {
    expect(countByStatus(["actionDecided", "actionDecided"])).toEqual({
      noActionNeeded: 0,
      objectiveReason: 0,
      actionDecided: 2,
      furtherAnalysis: 0,
    })
    expect(Object.keys(countByStatus([])).sort()).toEqual(
      [...ANALYSIS_STATUSES].sort()
    )
  })
})
