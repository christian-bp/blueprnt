import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { mockMutation, onQuery } from "@/test/convex-mocks"

const rejectSuggestionMock = mockMutation("ai.suggest.rejectSuggestion")
const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

vi.mock("convex/react", async () => {
  return (await import("@/test/convex-mocks")).convexReactModule
})
vi.mock("@workspace/backend/convex/_generated/api", async () => {
  return (await import("@/test/convex-mocks")).apiModule
})

import { useSuggestionFlow } from "@/hooks/use-suggestion-flow"

const schema = z.object({ note: z.string() })

function row(overrides: Record<string, unknown> = {}) {
  return {
    suggestionId: "sug-1",
    kind: "model.draft",
    status: "suggested",
    suggestedValue: { note: "hello" },
    errorCode: null,
    createdAt: Date.now(),
    roleId: null,
    ...overrides,
  }
}

function renderFlow(roleId?: string) {
  return renderHook(() =>
    useSuggestionFlow({
      orgId: "org-1",
      kind: "model.draft",
      schema,
      ...(roleId !== undefined ? { roleId } : {}),
    })
  )
}

describe("useSuggestionFlow", () => {
  beforeEach(() => {
    rejectSuggestionMock.mockReset()
    useQueryMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("reports loading then idle", () => {
    useQueryMock.mockReturnValue(undefined)
    const { result } = renderFlow()
    expect(result.current.loaded).toBe(false)
    expect(result.current.status).toBe("idle")

    useQueryMock.mockReturnValue([])
    const { result: loaded } = renderFlow()
    expect(loaded.current.loaded).toBe(true)
    expect(loaded.current.status).toBe("idle")
  })

  it("parses a suggested row and exposes its id", () => {
    useQueryMock.mockReturnValue([row()])
    const { result } = renderFlow()
    expect(result.current.status).toBe("suggested")
    expect(result.current.value).toEqual({ note: "hello" })
    expect(result.current.suggestionId).toBe("sug-1")
    expect(result.current.errorSubKey).toBeNull()
  })

  it("treats a malformed stored payload as an empty suggestion", () => {
    useQueryMock.mockReturnValue([row({ suggestedValue: { wrong: 1 } })])
    const { result } = renderFlow()
    expect(result.current.status).toBe("suggested")
    expect(result.current.value).toBeNull()
  })

  it("picks the newest row of the kind", () => {
    useQueryMock.mockReturnValue([
      row({ suggestionId: "old", createdAt: 1 }),
      row({ suggestionId: "new", createdAt: 2 }),
    ])
    const { result } = renderFlow()
    expect(result.current.suggestionId).toBe("new")
  })

  it("scopes to a role when roleId is given", () => {
    useQueryMock.mockReturnValue([
      row({ suggestionId: "other", roleId: "role-2" }),
      row({ suggestionId: "mine", roleId: "role-1", createdAt: 1 }),
    ])
    const { result } = renderFlow("role-1")
    expect(result.current.suggestionId).toBe("mine")
  })

  it("maps failed rows to the translated error sub-key", () => {
    useQueryMock.mockReturnValue([
      row({ status: "failed", errorCode: "errors.aiUnavailable" }),
    ])
    const { result } = renderFlow()
    expect(result.current.status).toBe("failed")
    expect(result.current.errorSubKey).toBe("aiUnavailable")
  })

  it("treats a generating row past the staleness threshold as failed", () => {
    useQueryMock.mockReturnValue([
      row({ status: "generating", createdAt: Date.now() - 91_000 }),
    ])
    const { result } = renderFlow()
    expect(result.current.status).toBe("failed")
    expect(result.current.errorSubKey).toBe("aiGenerationFailed")
  })

  it("reject dismisses the current row and no-ops without one", async () => {
    rejectSuggestionMock.mockResolvedValue(null)
    useQueryMock.mockReturnValue([row()])
    const { result } = renderFlow()
    await act(() => result.current.reject())
    expect(rejectSuggestionMock).toHaveBeenCalledWith({
      orgId: "org-1",
      suggestionId: "sug-1",
    })

    useQueryMock.mockReturnValue([])
    const { result: empty } = renderFlow()
    await act(() => empty.current.reject())
    expect(rejectSuggestionMock).toHaveBeenCalledTimes(1)
  })
})
