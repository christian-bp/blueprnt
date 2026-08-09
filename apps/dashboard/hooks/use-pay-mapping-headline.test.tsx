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
}

describe("usePayMappingHeadline", () => {
  beforeEach(() => {
    useQueryMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("carries the headlined run's identity and its org-level gap", () => {
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "payMapping.runs.listPayMappingRuns") return [RUN]
      if (ref === "payMapping.gap.getPayMappingGap") return GAP
      return undefined
    })
    const { result } = renderHook(() => usePayMappingHeadline("org-1"))
    expect(result.current?.slug).toBe(RUN.slug)
    expect(result.current?.gapPct).toBe(4.2)
    expect(result.current?.flag).toBe("elevated")
  })
})
