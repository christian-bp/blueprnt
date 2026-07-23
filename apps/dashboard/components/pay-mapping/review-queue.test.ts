import { describe, expect, it } from "vitest"
import type {
  GapGroup,
  GroupAnalysis,
  PayMappingGapResult,
  WomenDominatedComparisonWire,
  WomenDominatedGroupWire,
} from "./pay-mapping-gap-types"
import {
  buildReviewQueue,
  isStepDone,
  type ReviewQueue,
  type ReviewQueueInput,
  type ReviewStep,
  stepKey,
} from "./review-queue"

// noUncheckedIndexedAccess makes queue.steps[i] potentially undefined; this
// asserts it isn't, without a bare non-null assertion (Biome forbids those).
function stepAt(queue: ReviewQueue, index: number): ReviewStep {
  const step = queue.steps[index]
  if (step === undefined) {
    throw new Error(`no step at index ${index}`)
  }
  return step
}

function group(overrides: Partial<GapGroup> = {}): GapGroup {
  return {
    key: "k",
    roleTitle: "SWE",
    level: "Senior",
    band: 3,
    womenCount: 2,
    menCount: 2,
    womenMeanComp: 90000,
    menMeanComp: 100000,
    gapPct: 10,
    flag: "elevated",
    ...overrides,
  }
}

const COMPARISON: WomenDominatedComparisonWire = {
  key: "cmp-1",
  roleTitle: "Technician",
  level: "Mid",
  band: 3,
  headcount: 4,
  womenSharePct: 25,
  meanComp: 44000,
  diffPct: 10,
  diffSek: 4000,
}

function womenDominatedGroup(
  overrides: Partial<WomenDominatedGroupWire> = {}
): WomenDominatedGroupWire {
  return {
    key: "wd-1",
    roleTitle: "Nurse",
    level: "Senior",
    band: 3,
    headcount: 10,
    womenSharePct: 90,
    meanComp: 40000,
    comparisons: [],
    ...overrides,
  }
}

// 2 requiring equal-work groups (critical, elevated), 1 "ok" equal-work
// group (excluded), 1 women-dominated group with a comparator (required), 1
// without (excluded). Worst-first attention order for equal-work: critical
// ("sales") before elevated ("swe"); the group keyed "qa" is deliberately
// out of that order (it would sort last by key anyway) to prove the "ok"
// flag, not key order, excludes it.
const EQUAL_WORK: GapGroup[] = [
  group({
    key: "swe",
    roleTitle: "SWE",
    level: "Senior",
    gapPct: 8,
    flag: "elevated",
  }),
  group({
    key: "sales",
    roleTitle: "Sales",
    level: "Mid",
    gapPct: 15,
    flag: "critical",
  }),
  group({
    key: "qa",
    roleTitle: "QA",
    level: "Mid",
    gapPct: 2,
    flag: "ok",
  }),
]

const WOMEN_DOMINATED: WomenDominatedGroupWire[] = [
  womenDominatedGroup({
    key: "wd-1",
    roleTitle: "Nurse",
    comparisons: [COMPARISON],
  }),
  womenDominatedGroup({
    key: "wd-2",
    roleTitle: "Receptionist",
    comparisons: [],
  }),
]

const GAP: PayMappingGapResult = {
  currency: "SEK",
  org: {
    womenCount: 5,
    menCount: 5,
    womenMeanComp: 90000,
    menMeanComp: 100000,
    gapPct: 10,
    flag: "elevated",
  },
  equalWork: EQUAL_WORK,
  equivalentWork: [],
  womenDominated: WOMEN_DOMINATED,
  population: { women: 5, men: 5 },
  quartiles: [
    { women: 1, men: 1 },
    { women: 1, men: 1 },
    { women: 2, men: 2 },
    { women: 1, men: 1 },
  ],
  age: {
    buckets: Array.from({ length: 7 }, () => ({ women: 0, men: 0 })),
    unknown: 0,
  },
}

// All praxis areas + all requiring groups marked done, and collaboration
// filled: the "everything done" fixture for resumeIndex/progress tests.
const PRAXIS_AREAS_BASE = [
  "payPolicy",
  "collectiveAgreements",
  "benefits",
  "payPractices",
] as const

function praxisRow(area: string): GroupAnalysis {
  return {
    scope: "praxis",
    groupKey: area,
    reasons: [],
    note: null,
    done: true,
    finding: "none",
  }
}

function groupRow(
  scope: "equalWork" | "equivalentWork",
  groupKey: string
): GroupAnalysis {
  return {
    scope,
    groupKey,
    reasons: ["experience"],
    note: null,
    done: true,
    finding: null,
  }
}

const ALL_DONE_ANALYSES: GroupAnalysis[] = [
  ...PRAXIS_AREAS_BASE.map(praxisRow),
  groupRow("equalWork", "sales"),
  groupRow("equalWork", "swe"),
  groupRow("equivalentWork", "wd-1"),
]

const FILLED_COLLABORATION = {
  participants: "Fackforbundet A",
  description: "Samverkan genomford enligt plan.",
}

function baseInput(
  overrides: Partial<ReviewQueueInput> = {}
): ReviewQueueInput {
  return {
    gap: GAP,
    analyses: [],
    collaboration: null,
    hasPreviousCompletedRun: false,
    ...overrides,
  }
}

describe("stepKey", () => {
  it("returns a stable, distinct string per step kind", () => {
    expect(stepKey({ kind: "start" })).toBe("start")
    expect(stepKey({ kind: "finish" })).toBe("finish")
    expect(stepKey({ kind: "praxis", area: "payPolicy" })).toBe(
      "praxis:payPolicy"
    )
    expect(stepKey({ kind: "chapterIntro", chapter: "equalWork" })).toBe(
      "intro:equalWork"
    )
    expect(stepKey({ kind: "chapterIntro", chapter: "equivalentWork" })).toBe(
      "intro:equivalentWork"
    )
    expect(
      stepKey({
        kind: "group",
        scope: "equalWork",
        group: group({ key: "g1" }),
      })
    ).toBe("equalWork:g1")
    expect(
      stepKey({
        kind: "group",
        scope: "equivalentWork",
        group: womenDominatedGroup({ key: "wd-9" }),
      })
    ).toBe("equivalentWork:wd-9")
  })
})

describe("isStepDone", () => {
  it("start requires collaboration with both fields non-empty after trimming", () => {
    expect(isStepDone({ kind: "start" }, baseInput())).toBe(false)
    expect(
      isStepDone(
        { kind: "start" },
        baseInput({ collaboration: { participants: "  ", description: "x" } })
      )
    ).toBe(false)
    expect(
      isStepDone(
        { kind: "start" },
        baseInput({ collaboration: FILLED_COLLABORATION })
      )
    ).toBe(true)
  })

  it("start is not done when participants are filled but description is whitespace-only", () => {
    expect(
      isStepDone(
        { kind: "start" },
        baseInput({
          collaboration: { participants: "Fackforbundet A", description: "  " },
        })
      )
    ).toBe(false)
  })

  it("praxis requires a matching done analyses row in scope praxis", () => {
    const step: ReviewStep = { kind: "praxis", area: "payPolicy" }
    expect(isStepDone(step, baseInput())).toBe(false)
    expect(
      isStepDone(
        step,
        baseInput({
          analyses: [{ ...praxisRow("payPolicy"), done: false }],
        })
      )
    ).toBe(false)
    expect(
      isStepDone(step, baseInput({ analyses: [praxisRow("payPolicy")] }))
    ).toBe(true)
  })

  it("group requires a matching done analyses row in the step's scope", () => {
    const likaStep: ReviewStep = {
      kind: "group",
      scope: "equalWork",
      group: group({ key: "sales" }),
    }
    expect(isStepDone(likaStep, baseInput())).toBe(false)
    // A row in the wrong scope for the same key does not count.
    expect(
      isStepDone(
        likaStep,
        baseInput({ analyses: [groupRow("equivalentWork", "sales")] })
      )
    ).toBe(false)
    expect(
      isStepDone(
        likaStep,
        baseInput({ analyses: [groupRow("equalWork", "sales")] })
      )
    ).toBe(true)
  })

  it("chapterIntro and finish are always trivially done", () => {
    expect(
      isStepDone({ kind: "chapterIntro", chapter: "equalWork" }, baseInput())
    ).toBe(true)
    expect(isStepDone({ kind: "finish" }, baseInput())).toBe(true)
  })
})

describe("buildReviewQueue ordering", () => {
  it("orders start, base praxis areas, equalWork chapter, equivalentWork chapter, finish", () => {
    const queue = buildReviewQueue(baseInput())
    expect(queue.steps.map(stepKey)).toEqual([
      "start",
      "praxis:payPolicy",
      "praxis:collectiveAgreements",
      "praxis:benefits",
      "praxis:payPractices",
      "intro:equalWork",
      "equalWork:sales",
      "equalWork:swe",
      "intro:equivalentWork",
      "equivalentWork:wd-1",
      "finish",
    ])
  })

  it("appends previousActions last among praxis steps only when hasPreviousCompletedRun", () => {
    const withPrevious = buildReviewQueue(
      baseInput({ hasPreviousCompletedRun: true })
    )
    expect(
      withPrevious.steps
        .filter((s) => s.kind === "praxis")
        .map((s) => (s.kind === "praxis" ? s.area : null))
    ).toEqual([
      "payPolicy",
      "collectiveAgreements",
      "benefits",
      "payPractices",
      "previousActions",
    ])

    const withoutPrevious = buildReviewQueue(
      baseInput({ hasPreviousCompletedRun: false })
    )
    expect(withoutPrevious.steps.map(stepKey)).not.toContain(
      "praxis:previousActions"
    )
  })

  it("excludes ok-flag equal-work groups and zero-comparison women-dominated groups", () => {
    const queue = buildReviewQueue(baseInput())
    const keys = queue.steps.map(stepKey)
    expect(keys).not.toContain("equalWork:qa")
    expect(keys).not.toContain("equivalentWork:wd-2")
  })

  it("sorts requiring equal-work groups worst-flag-first via the ported attention sort", () => {
    const queue = buildReviewQueue(baseInput())
    const equalWorkKeys = queue.steps
      .filter((s) => s.kind === "group" && s.scope === "equalWork")
      .map(stepKey)
    expect(equalWorkKeys).toEqual(["equalWork:sales", "equalWork:swe"])
  })

  it("keeps women-dominated groups in the engine's delivered order", () => {
    const queue = buildReviewQueue(
      baseInput({
        gap: {
          ...GAP,
          womenDominated: [
            womenDominatedGroup({ key: "wd-a", comparisons: [COMPARISON] }),
            womenDominatedGroup({ key: "wd-b", comparisons: [COMPARISON] }),
          ],
        },
      })
    )
    const wdKeys = queue.steps
      .filter((s) => s.kind === "group" && s.scope === "equivalentWork")
      .map(stepKey)
    expect(wdKeys).toEqual(["equivalentWork:wd-a", "equivalentWork:wd-b"])
  })
})

describe("buildReviewQueue resumeIndex", () => {
  it("resumes at 0 (start) when nothing is done", () => {
    expect(buildReviewQueue(baseInput()).resumeIndex).toBe(0)
  })

  it("resumes at the first praxis step once collaboration is done", () => {
    const queue = buildReviewQueue(
      baseInput({ collaboration: FILLED_COLLABORATION })
    )
    expect(queue.resumeIndex).toBe(1)
    expect(queue.steps[queue.resumeIndex]).toEqual({
      kind: "praxis",
      area: "payPolicy",
    })
  })

  it("resumes at a specific undone group step, skipping the intro before it", () => {
    const queue = buildReviewQueue(
      baseInput({
        collaboration: FILLED_COLLABORATION,
        analyses: [
          ...PRAXIS_AREAS_BASE.map(praxisRow),
          groupRow("equalWork", "sales"),
          groupRow("equalWork", "swe"),
        ],
      })
    )
    // Everything through the equalWork chapter is done, so resume must land
    // on the first equivalentWork group step, never on the
    // "intro:equivalentWork" step in between.
    expect(stepKey(stepAt(queue, queue.resumeIndex))).toBe(
      "equivalentWork:wd-1"
    )
  })

  it("resumes at the finish step once everything actionable is done", () => {
    const queue = buildReviewQueue(
      baseInput({
        collaboration: FILLED_COLLABORATION,
        analyses: ALL_DONE_ANALYSES,
      })
    )
    expect(queue.resumeIndex).toBe(queue.steps.length - 1)
    expect(queue.steps[queue.resumeIndex]).toEqual({ kind: "finish" })
  })

  it("resumes at 0 (start) when only the start step is undone despite all analyses done", () => {
    const queue = buildReviewQueue(
      baseInput({
        collaboration: null,
        analyses: ALL_DONE_ANALYSES,
      })
    )
    expect(queue.resumeIndex).toBe(0)
    expect(stepAt(queue, queue.resumeIndex)).toEqual({ kind: "start" })
  })
})

describe("buildReviewQueue progress", () => {
  it("counts nothing done as zero across every bucket", () => {
    const queue = buildReviewQueue(baseInput())
    expect(queue.progress).toEqual({
      overall: { done: 0, total: 8 },
      praxis: { done: 0, total: 4 },
      equalWork: { done: 0, total: 2 },
      equivalentWork: { done: 0, total: 1 },
      collaborationDone: false,
    })
  })

  it("counts a partially-done queue correctly per chapter", () => {
    const queue = buildReviewQueue(
      baseInput({
        collaboration: FILLED_COLLABORATION,
        analyses: [praxisRow("payPolicy"), groupRow("equalWork", "sales")],
      })
    )
    expect(queue.progress).toEqual({
      overall: { done: 3, total: 8 },
      praxis: { done: 1, total: 4 },
      equalWork: { done: 1, total: 2 },
      equivalentWork: { done: 0, total: 1 },
      collaborationDone: true,
    })
  })

  it("counts everything done, including previousActions once applicable", () => {
    const queue = buildReviewQueue(
      baseInput({
        hasPreviousCompletedRun: true,
        collaboration: FILLED_COLLABORATION,
        analyses: [...ALL_DONE_ANALYSES, praxisRow("previousActions")],
      })
    )
    expect(queue.progress).toEqual({
      overall: { done: 9, total: 9 },
      praxis: { done: 5, total: 5 },
      equalWork: { done: 2, total: 2 },
      equivalentWork: { done: 1, total: 1 },
      collaborationDone: true,
    })
  })
})

describe("stepKey uniqueness", () => {
  it("is unique across every step in a built queue, including previousActions", () => {
    const queue = buildReviewQueue(baseInput({ hasPreviousCompletedRun: true }))
    const keys = queue.steps.map(stepKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("distinguishes steps by scope when equal-work and women-dominated groups share the same key", () => {
    const sharedKey = "shared-key"
    const customGap: PayMappingGapResult = {
      ...GAP,
      equalWork: [
        group({
          key: sharedKey,
          roleTitle: "SWE",
          level: "Senior",
          flag: "critical",
        }),
      ],
      womenDominated: [
        womenDominatedGroup({
          key: sharedKey,
          roleTitle: "Nurse",
          comparisons: [COMPARISON],
        }),
      ],
    }
    const queue = buildReviewQueue(baseInput({ gap: customGap }))
    const keys = queue.steps.map(stepKey)

    expect(keys).toContain(`equalWork:${sharedKey}`)
    expect(keys).toContain(`equivalentWork:${sharedKey}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
