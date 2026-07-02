import { describe, expect, it } from "vitest"
import type { MethodModel } from "@/lib/pdf/method-appendix-data"
import { assembleMethodAppendix } from "@/lib/pdf/method-appendix-data"

const base = {
  modelName: "Standard model",
  pointBudget: 6,
  bandThresholds: [
    { band: 1, minScore: 80 },
    { band: 2, minScore: 60 },
  ],
  criteria: [
    {
      criterionId: "c1",
      name: "Scope",
      description: "d",
      weightPoints: 3,
      share: 50,
      order: 1,
      purpose: "p",
      whyRelevant: "w",
      overlapNotes: null,
      biasRisk: "low" as const,
      biasComment: "b",
      biasAction: null,
      status: "approved" as const,
      decidedByName: "Alex",
      decidedAt: 1700000000000,
    },
    {
      criterionId: "c2",
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
      status: "notStarted" as const,
      decidedByName: null,
      decidedAt: null,
    },
  ],
  progress: { documented: 1, approved: 1, total: 2 },
} as const

describe("assembleMethodAppendix", () => {
  it("is DRAFT when not every criterion is approved", () => {
    const doc = assembleMethodAppendix(base, {
      biasStatement: "Bias-reducing, never bias-free.",
    })
    expect(doc.status).toBe("draft")
    expect(doc.criteria).toHaveLength(2)
    expect(doc.criteria[0]?.name).toBe("Scope")
  })

  it("is FINAL when every criterion is approved", () => {
    const allApproved = {
      ...base,
      criteria: base.criteria.map((c) => ({
        ...c,
        status: "approved" as const,
      })),
      progress: { documented: 2, approved: 2, total: 2 },
    }
    const doc = assembleMethodAppendix(allApproved, { biasStatement: "x" })
    expect(doc.status).toBe("final")
  })

  it("sorts criteria by ascending order regardless of input order", () => {
    const outOfOrder: MethodModel = {
      ...base,
      criteria: [base.criteria[1], base.criteria[0]],
    }
    const doc = assembleMethodAppendix(outOfOrder, { biasStatement: "x" })
    expect(doc.criteria[0]?.order).toBe(1)
    expect(doc.criteria[1]?.order).toBe(2)
  })

  it("is DRAFT when model has no criteria and progress.total is 0", () => {
    const empty: MethodModel = {
      ...base,
      criteria: [],
      progress: { documented: 0, approved: 0, total: 0 },
    }
    const doc = assembleMethodAppendix(empty, { biasStatement: "x" })
    expect(doc.status).toBe("draft")
  })
})
