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

import { useAssistantChat } from "@/hooks/use-assistant-chat"

describe("useAssistantChat", () => {
  beforeEach(() => {
    useQueryMock.mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("reports loading with no messages while the active-thread query has not resolved", () => {
    useQueryMock.mockImplementation(() => undefined)
    const { result } = renderHook(() => useAssistantChat("org-1"))
    expect(result.current.loading).toBe(true)
    expect(result.current.messages).toEqual([])
    expect(result.current.busy).toBe(false)
  })

  it("resolves to the empty thread (not loading) when there is no active conversation", () => {
    useQueryMock.mockImplementation((ref: string) =>
      ref === "assistant.chat.getActiveThread" ? null : undefined
    )
    const { result } = renderHook(() => useAssistantChat("org-1"))
    expect(result.current.loading).toBe(false)
    expect(result.current.messages).toEqual([])
    expect(result.current.thread).toBeNull()
  })

  it("derives busy=true when the last message is streaming", () => {
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "assistant.chat.getActiveThread") {
        return { _id: "thread-1", lastMessageAt: 0 }
      }
      if (ref === "assistant.chat.listMessages") {
        return [
          {
            _id: "m1",
            role: "user",
            status: "complete",
            parts: [{ type: "text", text: "Hi" }],
          },
          { _id: "m2", role: "assistant", status: "streaming", parts: [] },
        ]
      }
      return undefined
    })
    const { result } = renderHook(() => useAssistantChat("org-1"))
    expect(result.current.loading).toBe(false)
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.busy).toBe(true)
    expect(result.current.last?._id).toBe("m2")
  })

  it("derives busy=false once the last message has finished", () => {
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "assistant.chat.getActiveThread") {
        return { _id: "thread-1", lastMessageAt: 0 }
      }
      if (ref === "assistant.chat.listMessages") {
        return [
          {
            _id: "m1",
            role: "assistant",
            status: "complete",
            parts: [{ type: "text", text: "Done" }],
          },
        ]
      }
      return undefined
    })
    const { result } = renderHook(() => useAssistantChat("org-1"))
    expect(result.current.busy).toBe(false)
  })

  it("subscribes to the active thread's own messages", () => {
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "assistant.chat.getActiveThread") {
        return { _id: "thread-1", lastMessageAt: 0 }
      }
      if (ref === "assistant.chat.listMessages") return []
      return undefined
    })
    renderHook(() => useAssistantChat("org-1"))
    const listMessagesCall = useQueryMock.mock.calls.find(
      ([ref]) => ref === "assistant.chat.listMessages"
    )
    expect(listMessagesCall?.[1]).toEqual({
      orgId: "org-1",
      threadId: "thread-1",
    })
  })
})
