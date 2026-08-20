import { MODEL_MIN_CRITERIA } from "@workspace/core"
import { describe, expect, it } from "vitest"
import {
  chapterForSegment,
  chapterHref,
  chapterSegment,
  currentChapter,
  MODEL_CHAPTERS,
  type ModelProgressCheck,
  type ModelProgressInput,
  modelChapterProgress,
  modelProgress,
} from "@/lib/model-chapters"

// A check list built from overrides, so a test states only the checks it is
// about and every other check reads as passing.
function checks(
  overrides: Partial<Record<string, Partial<ModelProgressCheck>>> = {}
): ModelProgressCheck[] {
  const base: ModelProgressCheck[] = [
    { key: "dimensionCoverage", ok: true },
    { key: "workingConditionsTested", ok: true },
    { key: "criterionCount", ok: true, count: 6 },
    { key: "dimensionCaps", ok: true },
    { key: "anchorsComplete", ok: true },
    { key: "documentationComplete", ok: true },
    { key: "weightBudget", ok: true, count: 6 },
    { key: "levelRulesValid", ok: true },
    { key: "zoneProfileMonotonic", ok: true },
    { key: "dimensionWeightBalance", ok: true },
    { key: "peopleLeadershipWeight", ok: true },
    { key: "overlapPairs", ok: true },
  ]
  return base.map((check) => ({ ...check, ...overrides[check.key] }))
}

function input(
  overrides: Partial<ModelProgressInput> = {}
): ModelProgressInput {
  return {
    checks: checks(),
    approved: false,
    workingConditionsDecided: true,
    ...overrides,
  }
}

describe("the model chapter registry", () => {
  it("names the four chapters in the order the work is done", () => {
    expect([...MODEL_CHAPTERS]).toEqual([
      "criteria",
      "weighting",
      "method",
      "approval",
    ])
  })

  it("round-trips every chapter through its route segment", () => {
    for (const chapter of MODEL_CHAPTERS) {
      expect(chapterForSegment(chapterSegment(chapter))).toBe(chapter)
    }
  })

  it("has no page of its own and no segment for one", () => {
    expect(chapterForSegment(undefined)).toBeUndefined()
    expect(chapterForSegment("weighting-and-things")).toBeUndefined()
  })

  it("links a chapter at its own path under /model", () => {
    expect(chapterHref("criteria")).toBe("/model/criteria")
    expect(chapterHref("approval")).toBe("/model/approval")
  })

  it("resolves the open chapter from the path", () => {
    expect(currentChapter("/model/weighting")).toBe("weighting")
    // A deeper path still belongs to its chapter.
    expect(currentChapter("/model/method/anything")).toBe("method")
    // The section's own path is the redirect, not a chapter.
    expect(currentChapter("/model")).toBeUndefined()
    expect(currentChapter("/modelling")).toBeUndefined()
  })
})

describe("chapter progress", () => {
  // The model needs at least six criteria, so six is the work. Counting
  // against the maximum of eight would leave a finished selection reading as
  // three quarters done.
  it("counts the criteria chapter towards the minimum, not the maximum", () => {
    const at = (count: number) =>
      modelChapterProgress(
        input({
          checks: checks({ criterionCount: { count, ok: count >= 6 } }),
        }),
        "criteria"
      )
    expect(at(0)).toEqual({ done: 0, total: MODEL_MIN_CRITERIA })
    expect(at(3)).toEqual({ done: 3, total: MODEL_MIN_CRITERIA })
    expect(at(6)).toEqual({ done: 6, total: MODEL_MIN_CRITERIA })
    // Eight is still six of six: the ceiling is not more work.
    expect(at(8)).toEqual({ done: 6, total: MODEL_MIN_CRITERIA })
  })

  // A selection of six that breaks a dimension cap or leaves a mandatory
  // dimension uncovered is not a finished chapter, so it never reads as one.
  it("holds the criteria chapter open while its own checks fail", () => {
    for (const key of [
      "criterionCount",
      "dimensionCaps",
      "dimensionCoverage",
    ]) {
      const failing = modelChapterProgress(
        input({
          checks: checks({
            criterionCount: { count: 8, ok: key !== "criterionCount" },
            [key]: { ok: false },
          }),
        }),
        "criteria"
      )
      expect(failing.done, key).toBeLessThan(failing.total)
    }
  })

  // Weighting and documentation are other chapters' work: a criteria
  // selection is finished whether or not they are.
  it("does not hold the criteria chapter open on another chapter's check", () => {
    expect(
      modelChapterProgress(
        input({ checks: checks({ documentationComplete: { ok: false } }) }),
        "criteria"
      )
    ).toEqual({ done: 6, total: MODEL_MIN_CRITERIA })
  })

  // Criteria enter at weight 3, so a fresh selection's budget is already
  // exact: the chapter is allowed to open done.
  it("opens the weighting chapter done when the budget is born balanced", () => {
    expect(modelChapterProgress(input(), "weighting")).toEqual({
      done: 3,
      total: 3,
    })
  })

  it("counts the budget and each motivation the warnings ask for", () => {
    expect(
      modelChapterProgress(
        input({ checks: checks({ weightBudget: { ok: false } }) }),
        "weighting"
      )
    ).toEqual({ done: 2, total: 3 })
    expect(
      modelChapterProgress(
        input({
          checks: checks({
            dimensionWeightBalance: { ok: false },
            peopleLeadershipWeight: { ok: false },
          }),
        }),
        "weighting"
      )
    ).toEqual({ done: 1, total: 3 })
  })

  // The overlap warning is satisfied by the overlap protokoll, which is
  // Metod's work, so it is not one of Viktning's motivations.
  it("leaves the overlap warning out of the weighting chapter", () => {
    expect(
      modelChapterProgress(
        input({ checks: checks({ overlapPairs: { ok: false } }) }),
        "weighting"
      )
    ).toEqual({ done: 3, total: 3 })
  })

  // One protokoll per criterion plus the materiality decision, which is what
  // makes Metod the widest segment on the bar.
  it("counts one documentation step per criterion, plus the materiality decision", () => {
    expect(
      modelChapterProgress(
        input({
          checks: checks({
            criterionCount: { count: 7 },
            documentationComplete: { ok: false, criterionIds: ["a", "b"] },
          }),
        }),
        "method"
      )
    ).toEqual({ done: 6, total: 8 })
    expect(
      modelChapterProgress(
        input({
          checks: checks({ criterionCount: { count: 7 } }),
          workingConditionsDecided: false,
        }),
        "method"
      )
    ).toEqual({ done: 7, total: 8 })
  })

  it("counts approval as the one step it is", () => {
    expect(modelChapterProgress(input(), "approval")).toEqual({
      done: 0,
      total: 1,
    })
    expect(modelChapterProgress(input({ approved: true }), "approval")).toEqual(
      { done: 1, total: 1 }
    )
  })

  // An org with no model at all still has the same four chapters ahead of it.
  it("reads a model that does not exist yet as nothing decided", () => {
    const empty: ModelProgressInput = {
      checks: [],
      approved: false,
      workingConditionsDecided: false,
    }
    expect(modelProgress(empty).done).toBe(0)
    expect(modelProgress(empty).total).toBeGreaterThan(0)
  })

  it("sums the whole section from its chapters", () => {
    const all = input({ approved: true })
    const summed = MODEL_CHAPTERS.reduce(
      (sum, chapter) => sum + modelChapterProgress(all, chapter).done,
      0
    )
    expect(modelProgress(all).done).toBe(summed)
  })
})
