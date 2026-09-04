import { describe, expect, it } from "vitest"
import { chapterContinuationShown } from "./analysis-chapters"
import type { ReviewQueue } from "./review-queue"

function queueWith(
  progress: Partial<ReviewQueue["progress"]> = {}
): ReviewQueue {
  return {
    steps: [],
    resumeIndex: 0,
    progress: {
      overall: { done: 0, total: 0 },
      praxis: { done: 0, total: 0 },
      equalWork: { done: 0, total: 0 },
      equivalentWork: { done: 0, total: 0 },
      collaborationDone: false,
      ...progress,
    },
  }
}

// The one derivation behind two surfaces: the section shell draws the link
// on to the next chapter, and the open step drops its own primary action, on
// exactly this answer. They used to derive it separately, which is how they
// could disagree and put two ways forward on one screen.
describe("chapterContinuationShown", () => {
  it("is false while the queue has not loaded", () => {
    expect(chapterContinuationShown(null, "praxis")).toBe(false)
    expect(chapterContinuationShown(undefined, "praxis")).toBe(false)
  })

  it("is false off a chapter page", () => {
    expect(chapterContinuationShown(queueWith(), undefined)).toBe(false)
  })

  it("is false while the chapter still has work left", () => {
    const queue = queueWith({ praxis: { done: 2, total: 5 } })
    expect(chapterContinuationShown(queue, "praxis")).toBe(false)
  })

  it("is true once every step in the chapter is documented", () => {
    const queue = queueWith({ praxis: { done: 5, total: 5 } })
    expect(chapterContinuationShown(queue, "praxis")).toBe(true)
  })

  // An empty chapter is not a finished one: 0 of 0 would otherwise read as
  // complete and offer to move on from a chapter that never asked anything.
  it("is false for a chapter with no steps at all", () => {
    const queue = queueWith({ equalWork: { done: 0, total: 0 } })
    expect(chapterContinuationShown(queue, "equalWork")).toBe(false)
  })

  // The start chapter is one step, carried as a boolean rather than a count.
  it("reads the start chapter's own single-step progress", () => {
    expect(
      chapterContinuationShown(queueWith({ collaborationDone: false }), "start")
    ).toBe(false)
    expect(
      chapterContinuationShown(queueWith({ collaborationDone: true }), "start")
    ).toBe(true)
  })

  // The analysis ends at equivalent work, so its steps keep their own
  // primary action to the last one: there is nowhere to continue to.
  it("is false for the last chapter even when it is finished", () => {
    const queue = queueWith({ equivalentWork: { done: 3, total: 3 } })
    expect(chapterContinuationShown(queue, "equivalentWork")).toBe(false)
  })
})
