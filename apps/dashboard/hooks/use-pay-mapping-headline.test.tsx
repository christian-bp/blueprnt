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
}

const GAP = {
  org: { gapPct: 4.2, flag: "elevated" },
  quartiles: [
    { women: 3, men: 1 },
    { women: 2, men: 2 },
    { women: 1, men: 3 },
    { women: 0, men: 4 },
  ],
}

describe("usePayMappingHeadline", () => {
  beforeEach(() => {
    useQueryMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("carries the gap query's quartiles alongside the org headline", () => {
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "payMapping.runs.listPayMappingRuns") return [RUN]
      if (ref === "payMapping.gap.getPayMappingGap") return GAP
      return undefined
    })
    const { result } = renderHook(() => usePayMappingHeadline("org-1"))
    expect(result.current?.quartiles).toHaveLength(4)
    expect(result.current?.quartiles[0]).toEqual({ women: 3, men: 1 })
  })
})
