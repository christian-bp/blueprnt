import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { onQuery } from "@/test/convex-mocks"

const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

import { useAssistantThreads } from "@/hooks/use-assistant-threads"

describe("useAssistantThreads", () => {
  beforeEach(() => {
    useQueryMock.mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("reports loading with an empty list while listThreads has not resolved", () => {
    useQueryMock.mockImplementation(() => undefined)
    const { result } = renderHook(() => useAssistantThreads("org-1"))
    expect(result.current.loading).toBe(true)
    expect(result.current.threads).toEqual([])
  })

  it("resolves to the caller's own thread list, most recent first", () => {
    const threads = [
      {
        _id: "thread-2",
        title: "Pay gap trend",
        status: "active",
        lastMessageAt: 200,
      },
      { _id: "thread-1", status: "archived", lastMessageAt: 100 },
    ]
    useQueryMock.mockImplementation((ref: string) =>
      ref === "assistant.chat.listThreads" ? threads : undefined
    )
    const { result } = renderHook(() => useAssistantThreads("org-1"))
    expect(result.current.loading).toBe(false)
    expect(result.current.threads).toEqual(threads)
  })

  it("subscribes with the caller's own orgId", () => {
    useQueryMock.mockImplementation((ref: string) =>
      ref === "assistant.chat.listThreads" ? [] : undefined
    )
    renderHook(() => useAssistantThreads("org-1"))
    expect(useQueryMock).toHaveBeenCalledWith("assistant.chat.listThreads", {
      orgId: "org-1",
    })
  })
})
