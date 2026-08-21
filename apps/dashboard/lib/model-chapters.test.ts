import { MODEL_MIN_CRITERIA } from "@workspace/core"
import { describe, expect, it } from "vitest"
import {
  chapterHref,
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
    weightsSaved: false,
    ...overrides,
  }
}

// The Kriterier chapter's own total: six criteria plus the working-conditions
// materiality decision, which the fourth column asks for on that chapter.
const CRITERIA_TOTAL = MODEL_MIN_CRITERIA + 1

describe("the model chapter registry", () => {
  it("names the four chapters in the order the work is done", () => {
    expect([...MODEL_CHAPTERS]).toEqual([
      "criteria",
      "weighting",
      "method",
      "approval",
    ])
  })

  // Round-tripped through the public pair rather than the private segment
  // map: linking to a chapter and resolving the chapter you landed on is the
  // contract every surface actually depends on.
  it("round-trips every chapter from its href back to itself", () => {
    for (const chapter of MODEL_CHAPTERS) {
      expect(currentChapter(chapterHref(chapter))).toBe(chapter)
    }
  })

  it("gives every chapter its own distinct path", () => {
    const hrefs = MODEL_CHAPTERS.map(chapterHref)
    expect(new Set(hrefs).size).toBe(hrefs.length)
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
    // The counts below all run with the materiality decision recorded, which
    // is the chapter's seventh unit and always the last +1 here.
    expect(at(0)).toEqual({ done: 1, total: CRITERIA_TOTAL })
    expect(at(3)).toEqual({ done: 4, total: CRITERIA_TOTAL })
    expect(at(6)).toEqual({ done: 7, total: CRITERIA_TOTAL })
    // Eight is still six of six: the ceiling is not more work.
    expect(at(8)).toEqual({ done: 7, total: CRITERIA_TOTAL })
  })

  // The materiality decision is the Kriterier chapter's own unit now that the
  // fourth column is where it is made: a selection of six with the dimension
  // untested is six of seven, and the column is showing the prompt that closes
  // it. The ENGINE's check, so the spine and the approval gate agree.
  //
  // This also covers the decided-but-unstaffed state (a recorded ACTIVE
  // decision over an empty working-conditions dimension). The engine's
  // active branch requires exactly one working-conditions criterion
  // (method-checks.ts, pinned by "rejects an active decision without a
  // working-conditions criterion"), so the check is NOT ok there and the
  // chapter honestly reads six of seven while the column asks for a criterion
  // or a different decision. Nothing extra is needed here for it: the state
  // reaches this derivation as exactly this failing check.
  it("counts the working-conditions materiality decision as the chapter's seventh unit", () => {
    expect(
      modelChapterProgress(
        input({ checks: checks({ workingConditionsTested: { ok: false } }) }),
        "criteria"
      )
    ).toEqual({ done: 6, total: CRITERIA_TOTAL })
    expect(modelChapterProgress(input(), "criteria")).toEqual({
      done: 7,
      total: CRITERIA_TOTAL,
    })
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
    ).toEqual({ done: 7, total: CRITERIA_TOTAL })
  })

  // Criteria enter at weight 3, so a fresh selection's budget is already
  // exact: the chapter is allowed to open done, but only once Kriterier
  // itself is complete (the default fixture's six criteria pass every
  // station check).
  // Born-done was the first dishonesty. Criteria enter at 3 points and the
  // budget is the criteria count times 3, so a selection is already balanced
  // the moment it exists and the budget check passes on a model nobody has
  // opened. The unit is the SAVE now, so a fresh six-criteria selection with
  // no save reads zero for it.
  it("opens the weighting chapter at zero on a selection nobody has weighed", () => {
    expect(modelChapterProgress(input(), "weighting")).toEqual({
      done: 0,
      total: 3,
    })
  })

  it("counts the save once a human has performed it", () => {
    expect(
      modelChapterProgress(input({ weightsSaved: true }), "weighting")
    ).toEqual({ done: 3, total: 3 })
  })

  // A fresh org with no criteria yet must not read as begun. The motivation
  // warnings are the engine's, so they do not exist on an empty model, and the
  // save has not happened: 0 of 1, with nothing invented for work that cannot
  // be started.
  it("shows an untouched model as zero, with no units it cannot have", () => {
    const freshOrg = input({
      checks: [],
    })
    expect(modelChapterProgress(freshOrg, "weighting")).toEqual({
      done: 0,
      total: 1,
    })
  })

  it("counts the save and each motivation the warnings ask for", () => {
    expect(
      modelChapterProgress(
        input({
          weightsSaved: true,
          checks: checks({ weightBudget: { ok: false } }),
        }),
        "weighting"
      )
    ).toEqual({ done: 3, total: 3 })
    expect(
      modelChapterProgress(
        input({
          weightsSaved: true,
          checks: checks({
            dimensionWeightBalance: { ok: false },
            peopleLeadershipWeight: { ok: false },
          }),
        }),
        "weighting"
      )
    ).toEqual({ done: 1, total: 3 })
  })

  // THE OWNER'S CASE. Five active criteria (one under the minimum), a real
  // save, and one of the two motivations written: the chapter reported "0 of
  // 3" against work visibly on screen, because it zeroed itself whenever
  // Kriterier was incomplete. A unit is the user's own act, and a neighbouring
  // chapter cannot un-perform it.
  it("keeps a saved weighting counted when the selection drops below the minimum", () => {
    const fiveCriteria = input({
      weightsSaved: true,
      checks: checks({
        criterionCount: { count: 5, ok: false },
        peopleLeadershipWeight: { ok: false },
      }),
    })
    const criteria = modelChapterProgress(fiveCriteria, "criteria")
    expect(criteria.done).toBeLessThan(criteria.total)
    expect(modelChapterProgress(fiveCriteria, "weighting")).toEqual({
      done: 2,
      total: 3,
    })
  })

  // The overlap warning is satisfied by the overlap protokoll, which is
  // Metod's work, so it is not one of Viktning's motivations.
  it("leaves the overlap warning out of the weighting chapter", () => {
    expect(
      modelChapterProgress(
        input({
          weightsSaved: true,
          checks: checks({ overlapPairs: { ok: false } }),
        }),
        "weighting"
      )
    ).toEqual({ done: 3, total: 3 })
  })

  // One protokoll per criterion and nothing else, which is what makes Metod
  // the widest segment on the bar. The materiality decision is NOT counted
  // here: it is the Kriterier chapter's unit, and counting it twice would put
  // one decision on two chapters.
  it("counts one documentation step per criterion, and only that", () => {
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
    ).toEqual({ done: 5, total: 7 })
    expect(
      modelChapterProgress(
        input({
          checks: checks({
            criterionCount: { count: 7 },
            workingConditionsTested: { ok: false },
          }),
        }),
        "method"
      )
    ).toEqual({ done: 7, total: 7 })
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
      weightsSaved: false,
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
