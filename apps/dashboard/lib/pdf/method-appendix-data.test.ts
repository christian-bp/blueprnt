import { LEVEL_RULES } from "@workspace/core"
import { describe, expect, it } from "vitest"
import type {
  MethodAppendixLibrary,
  MethodModel,
} from "@/lib/pdf/method-appendix-data"
import { assembleMethodAppendix } from "@/lib/pdf/method-appendix-data"

const LIBRARY: MethodAppendixLibrary = {
  sharedScale: {
    "1": { name: "Bounded", meaning: "m1" },
    "2": { name: "Basic to moderate", meaning: "m2" },
    "3": { name: "Independent", meaning: "m3" },
    "4": { name: "Advanced", meaning: "m4" },
    "5": { name: "Very advanced", meaning: "m5" },
  },
  midpoints: { step2: "mid-2", step4: "mid-4" },
  anchorsByKey: {
    "scope-impact": [
      { step: 1, text: "a1" },
      { step: 3, text: "a3" },
      { step: 5, text: "a5" },
    ],
    "risk-consequence": [
      { step: 1, text: "r1" },
      { step: 3, text: "r3" },
      { step: 5, text: "r5" },
    ],
  },
}

const ZONE_NAMES = { A: "Zone A name", B: "B", C: "C", D: "D" } as const

const base: MethodModel = {
  modelName: "Standard model",
  pointBudget: 6,
  workingConditions: {
    status: "testedNotMaterial",
    motivation: "No recurring exposure.",
    decidedAt: 1700000000000,
  },
  criteria: [
    {
      criterionId: "c1",
      libraryKey: "scope-impact",
      name: "Scope",
      description: "d",
      weightPoints: 3,
      share: 50,
      order: 1,
      purpose: "p",
      whyRelevant: "w",
      overlapNotes: null,
      biasRisk: "low",
      biasComment: "b",
      biasAction: null,
      status: "approved",
      decidedByName: "Alex",
      decidedAt: 1700000000000,
    },
    {
      criterionId: "c2",
      libraryKey: "risk-consequence",
      name: "Risk",
      description: "d",
      weightPoints: 3,
      share: 50,
      order: 2,
      purpose: null,
      whyRelevant: null,
      overlapNotes: null,
      biasRisk: null,
      biasComment: null,
      biasAction: null,
      status: "notStarted",
      decidedByName: null,
      decidedAt: null,
    },
  ],
  progress: { documented: 1, approved: 1, total: 2 },
}

const assemble = (model: MethodModel) =>
  assembleMethodAppendix(model, LIBRARY, ZONE_NAMES, {
    biasStatement: "Bias-reducing, never bias-free.",
  })

describe("assembleMethodAppendix", () => {
  it("is DRAFT when not every criterion is approved", () => {
    const doc = assemble(base)
    expect(doc.status).toBe("draft")
    expect(doc.criteria).toHaveLength(2)
    expect(doc.criteria[0]?.name).toBe("Scope")
  })

  it("is FINAL when every criterion is approved", () => {
    const allApproved: MethodModel = {
      ...base,
      criteria: base.criteria.map((c) => ({
        ...c,
        status: "approved" as const,
      })),
      progress: { documented: 2, approved: 2, total: 2 },
    }
    expect(assemble(allApproved).status).toBe("final")
  })

  it("sorts criteria by ascending order regardless of input order", () => {
    const outOfOrder: MethodModel = {
      ...base,
      criteria: [base.criteria[1], base.criteria[0]] as MethodModel["criteria"],
    }
    const doc = assemble(outOfOrder)
    expect(doc.criteria[0]?.order).toBe(1)
    expect(doc.criteria[1]?.order).toBe(2)
  })

  it("is DRAFT when model has no criteria and progress.total is 0", () => {
    const empty: MethodModel = {
      ...base,
      criteria: [],
      progress: { documented: 0, approved: 0, total: 0 },
    }
    expect(assemble(empty).status).toBe("draft")
  })

  // The full ladder per criterion: the library's 1/3/5 with the midpoints
  // filling 2/4, exactly as the rating stepper resolves them.
  it("resolves each criterion's anchors with the shared midpoints", () => {
    const doc = assemble(base)
    expect(doc.criteria[0]?.anchors).toEqual([
      { step: 1, text: "a1" },
      { step: 2, text: "mid-2" },
      { step: 3, text: "a3" },
      { step: 4, text: "mid-4" },
      { step: 5, text: "a5" },
    ])
  })

  // The twelve thresholds grouped under their zones (highest first), each
  // zone carrying its own gate; a zone without a rule reads null, never 0.
  it("groups the thresholds under their zones with each zone's gate", () => {
    const doc = assemble(base)
    expect(doc.zones.map((zone) => zone.key)).toEqual(["A", "B", "C", "D"])
    expect(doc.zones[0]?.name).toBe("Zone A name")
    expect(doc.zones[0]?.levels.map((row) => row.level)).toEqual([1, 2, 3])
    expect(doc.zones[0]?.minStep).toBe(4)
    expect(doc.zones[1]?.minStep).toBe(3)
    expect(doc.zones[2]?.minStep).toBeNull()
    // The printed numbers are the method's own ladder, read from packages/core
    // rather than from anything the org can supply: an appendix that documents
    // a different ladder than the engine places on is not evidence.
    expect(doc.zones.flatMap((zone) => zone.levels)).toEqual(
      LEVEL_RULES.map((rule) => ({
        level: rule.level,
        minScore: rule.minScore,
      }))
    )
  })

  it("carries the scale and the materiality decision through", () => {
    const doc = assemble(base)
    expect(doc.scaleSteps).toHaveLength(5)
    expect(doc.scaleSteps[3]).toEqual({
      step: 4,
      name: "Advanced",
      meaning: "m4",
    })
    expect(doc.workingConditions?.status).toBe("testedNotMaterial")
    expect(
      assemble({ ...base, workingConditions: null }).workingConditions
    ).toBeNull()
  })
})
