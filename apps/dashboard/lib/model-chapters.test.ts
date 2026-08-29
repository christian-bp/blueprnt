import { METHOD_CHECK_KEYS, MODEL_MIN_CRITERIA } from "@workspace/core"
import daMessages from "@workspace/i18n/messages/da.json"
import messages from "@workspace/i18n/messages/en.json"
import fiMessages from "@workspace/i18n/messages/fi.json"
import nbMessages from "@workspace/i18n/messages/nb.json"
import svMessages from "@workspace/i18n/messages/sv.json"
import { describe, expect, it } from "vitest"
import {
  CHECK_CHAPTER,
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
    { key: "dimensionWeightBalance", ok: true },
    // The owner's own model: no people-leadership criterion selected, so the
    // engine reports that obligation as not applying at all.
    { key: "peopleLeadershipWeight", ok: true, applies: false },
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
  // The chapter counts OBLIGATIONS, like Kriterier does: the save act, plus
  // one unit per motivation obligation this model actually carries. The
  // fixture's model has no people-leadership criterion, so that obligation
  // does not exist for it and is not counted.
  it("counts nothing on a selection nobody has weighed", () => {
    expect(modelChapterProgress(input(), "weighting")).toEqual({
      done: 0,
      total: 2,
    })
  })

  it("counts the save and the obligations it has met", () => {
    expect(
      modelChapterProgress(input({ weightsSaved: true }), "weighting")
    ).toEqual({ done: 2, total: 2 })
  })

  // A model that DID select a people-leadership criterion carries that
  // obligation too, so its total is one higher. Applicability comes from the
  // engine, which is the only thing that knows the selection.
  it("counts the people-leadership obligation only where it exists", () => {
    const withLeadership = input({
      weightsSaved: true,
      checks: checks({
        peopleLeadershipWeight: { ok: false, applies: true },
      }),
    })
    expect(modelChapterProgress(withLeadership, "weighting")).toEqual({
      done: 2,
      total: 3,
    })
  })

  // THE ASYMMETRY. dimensionWeightBalance is unconditional: every weighted
  // model can have a dimension run away with the allocation, so the
  // obligation is live from the moment there is a weighting. Dragging weights
  // must therefore move FULFILMENT and never the total, or the chapter's
  // denominator would jitter under the reader's own hand.
  it("holds its total still while a dominance warning comes and goes", () => {
    const totals = [true, false, true].map(
      (ok) =>
        modelChapterProgress(
          input({
            weightsSaved: true,
            checks: checks({ dimensionWeightBalance: { ok } }),
          }),
          "weighting"
        ).total
    )
    expect(totals).toEqual([2, 2, 2])
    // And the fulfilment is what moves.
    expect(
      modelChapterProgress(
        input({
          weightsSaved: true,
          checks: checks({ dimensionWeightBalance: { ok: false } }),
        }),
        "weighting"
      ).done
    ).toBe(1)
  })

  // An untouched model must not read as begun, whatever its checks say
  // vacuously: both warnings report ok when they simply do not fire.
  it("shows an untouched model as zero", () => {
    expect(modelChapterProgress(input({ checks: [] }), "weighting")).toEqual({
      done: 0,
      total: 1,
    })
  })

  // THE OWNER'S CASE. Five active criteria (one under the minimum) and a real
  // save: the chapter reported zero against work visibly on screen, because it
  // zeroed itself whenever Kriterier was incomplete. A unit is the user's own
  // act, and a neighbouring chapter cannot un-perform it.
  it("keeps a saved weighting counted when the selection drops below the minimum", () => {
    const fiveCriteria = input({
      weightsSaved: true,
      checks: checks({
        criterionCount: { count: 5, ok: false },
        dimensionWeightBalance: { ok: false },
      }),
    })
    const criteria = modelChapterProgress(fiveCriteria, "criteria")
    expect(criteria.done).toBeLessThan(criteria.total)
    expect(modelChapterProgress(fiveCriteria, "weighting")).toEqual({
      done: 1,
      total: 2,
    })
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

// Every check's remedy has to be true of the app as it stands. Two of them told
// the reader the level thresholds "cannot be corrected in the app yet", on the
// same screen as the section that corrects them, because the copy was written
// when that was true and nothing re-read it when the surface shipped.
const allMessages = {
  en: messages,
  sv: svMessages,
  nb: nbMessages,
  da: daMessages,
  fi: fiMessages,
}

describe("CHECK_CHAPTER and its remedies", () => {
  const remedies = messages.dashboard.model.method.remedies

  it("routes every check to a chapter that can actually fix it", () => {
    for (const key of METHOD_CHECK_KEYS) {
      const chapter = CHECK_CHAPTER[key]
      // null stays legal as a reviewed decision, but nothing claims it today.
      expect(chapter === null || MODEL_CHAPTERS.includes(chapter)).toBe(true)
    }
  })

  // In every locale, because a denial left in one locale is the same defect.
  it.each(["en", "sv", "nb", "da", "fi"] as const)(
    "always tells the reader where the fix is, in %s",
    (locale) => {
      const localeMessages = allMessages[locale]
      const localeRemedies = localeMessages.dashboard.model.method
        .remedies as Record<string, string>
      // Every check's fix lives on another chapter, so every remedy carries
      // the link to it. A blacklist of denial PHRASES was tried here first and
      // is not a pin: it passes any wording nobody thought to list, and it
      // proved it by passing a planted "det gar inte att ratta i appen annu"
      // that meant exactly what the listed phrase meant. This is the positive
      // claim instead, and a denial cannot satisfy it in any wording.
      for (const key of METHOD_CHECK_KEYS) {
        const text = localeRemedies[key]
        if (text === undefined) continue
        const directs = text.includes("<link>")
        expect({ key, directs }).toEqual({ key, directs: true })
      }
    }
  )

  // A remedy with no chapter must carry no <link> tag, and one with a chapter
  // must: the renderer passes the tag only in the second case.
  it("matches each remedy's link tag to whether it has a chapter to link to", () => {
    for (const key of METHOD_CHECK_KEYS) {
      const text = (remedies as Record<string, string>)[key]
      if (text === undefined) continue
      const chapter = CHECK_CHAPTER[key]
      expect({ key, linked: text.includes("<link>") }).toEqual({
        key,
        linked: chapter !== null,
      })
    }
  })
})
