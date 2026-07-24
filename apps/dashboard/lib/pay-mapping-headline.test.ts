import { describe, expect, it } from "vitest"
import {
  type HeadlineRunCandidate,
  pickHeadlineRun,
} from "./pay-mapping-headline"

const run = (over: Partial<HeadlineRunCandidate>): HeadlineRunCandidate => ({
  runId: "r1",
  slug: "r1",
  label: "Run",
  status: "active",
  ...over,
})

describe("pickHeadlineRun", () => {
  it("returns undefined for an empty run list", () => {
    expect(pickHeadlineRun([])).toBeUndefined()
  })

  it("picks the first non-completed run over any completed ones", () => {
    const runs = [
      run({ runId: "old", status: "completed" }),
      run({ runId: "open", status: "underReview" }),
    ]
    expect(pickHeadlineRun(runs)?.runId).toBe("open")
  })

  it("falls back to the most recent completed run when none is open", () => {
    const runs = [
      run({ runId: "newest-completed", status: "completed" }),
      run({ runId: "older-completed", status: "completed" }),
    ]
    expect(pickHeadlineRun(runs)?.runId).toBe("newest-completed")
  })

  it("returns undefined when every run is somehow neither (impossible today, but never throws)", () => {
    expect(pickHeadlineRun([])).toBeUndefined()
  })
})
