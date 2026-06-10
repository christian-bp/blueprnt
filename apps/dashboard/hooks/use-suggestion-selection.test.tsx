import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { useSuggestionSelection } from "@/hooks/use-suggestion-selection"

describe("useSuggestionSelection", () => {
  afterEach(() => {
    cleanup()
  })

  it("seeds once per suggestion id and keeps user toggles", () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) =>
        useSuggestionSelection(id, () => [0, 1, 2]),
      { initialProps: { id: "sug-1" as string | null } }
    )
    expect([...result.current.accepted].sort()).toEqual([0, 1, 2])

    act(() => result.current.toggle(1, false))
    expect(result.current.accepted.has(1)).toBe(false)

    // Re-render with the SAME id: the toggle survives (no reseed).
    rerender({ id: "sug-1" })
    expect(result.current.accepted.has(1)).toBe(false)
  })

  it("reseeds when a new suggestion id arrives", () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) =>
        useSuggestionSelection(id, () => ["a", "b"]),
      { initialProps: { id: "sug-1" as string | null } }
    )
    act(() => result.current.toggle("a", false))
    rerender({ id: "sug-2" })
    expect([...result.current.accepted].sort()).toEqual(["a", "b"])
  })

  it("stays empty without a suggestion", () => {
    const { result } = renderHook(() => useSuggestionSelection(null, () => [0]))
    expect(result.current.accepted.size).toBe(0)
  })
})
