import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { onQuery } from "@/test/convex-mocks"

const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

vi.mock("convex/react", async () => {
  return (await import("@/test/convex-mocks")).convexReactModule
})
vi.mock("@workspace/backend/convex/_generated/api", async () => {
  return (await import("@/test/convex-mocks")).apiModule
})

import { usePayMappingHeadline } from "@/hooks/use-pay-mapping-headline"

const RUN = {
  runId: "run-1",
  slug: "run-1-slug",
  label: "2026",
  status: "active" as const,
  orgGapPct: 4.2,
  orgGapFlag: "elevated" as const,
}

describe("usePayMappingHeadline", () => {
  beforeEach(() => {
    useQueryMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("carries the headlined run's identity and its frozen org-level gap", () => {
    useQueryMock.mockImplementation((ref: string) =>
      ref === "payMapping.runs.listPayMappingRuns" ? [RUN] : undefined
    )
    const { result } = renderHook(() => usePayMappingHeadline("org-1"))
    expect(result.current?.slug).toBe(RUN.slug)
    expect(result.current?.gapPct).toBe(4.2)
    expect(result.current?.flag).toBe("elevated")
  })

  // The gap is frozen on the run row precisely so the home dashboard does not
  // have to run getPayMappingGap, which collects every snapshot row of the
  // run to compute a pipeline this card reads two numbers from. A second
  // subscription reappearing here is the regression, so it is asserted rather
  // than left to review.
  it("reads the gap off the run list without a second query", () => {
    useQueryMock.mockImplementation((ref: string) =>
      ref === "payMapping.runs.listPayMappingRuns" ? [RUN] : undefined
    )
    renderHook(() => usePayMappingHeadline("org-1"))
    const queried = useQueryMock.mock.calls.map(([ref]) => ref)
    expect(queried).toContain("payMapping.runs.listPayMappingRuns")
    expect(queried).not.toContain("payMapping.gap.getPayMappingGap")
  })

  it("stays null for an org that has never mapped", () => {
    useQueryMock.mockImplementation((ref: string) =>
      ref === "payMapping.runs.listPayMappingRuns" ? [] : undefined
    )
    const { result } = renderHook(() => usePayMappingHeadline("org-1"))
    expect(result.current).toBeNull()
  })

  it("stays undefined while the run list loads", () => {
    useQueryMock.mockImplementation(() => undefined)
    const { result } = renderHook(() => usePayMappingHeadline("org-1"))
    expect(result.current).toBeUndefined()
  })
})
