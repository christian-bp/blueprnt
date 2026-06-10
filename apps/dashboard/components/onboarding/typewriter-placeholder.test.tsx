import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const reducedMotionMock = vi.fn(() => false)
vi.mock("motion/react", () => ({
  useReducedMotion: () => reducedMotionMock(),
}))

import { TypewriterPlaceholder } from "@/components/onboarding/typewriter-placeholder"

function text(): string {
  return screen.getByTestId("typewriter-placeholder").textContent ?? ""
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe("TypewriterPlaceholder", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    reducedMotionMock.mockReturnValue(false)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("types in, holds, erases, and cycles to the next phrase", () => {
    render(<TypewriterPlaceholder phrases={["ab", "xy"]} />)
    expect(text()).toBe("")

    // Typing: one character per tick.
    advance(35)
    expect(text()).toBe("a")
    advance(35)
    expect(text()).toBe("ab")

    // Holds the full phrase, then erases character by character.
    advance(2200)
    expect(text()).toBe("ab")
    advance(18)
    expect(text()).toBe("a")
    advance(18)
    expect(text()).toBe("")

    // After the gap the next phrase starts typing.
    advance(600)
    advance(35)
    expect(text()).toBe("x")
  })

  it("shows the first phrase statically under reduced motion", () => {
    reducedMotionMock.mockReturnValue(true)
    render(<TypewriterPlaceholder phrases={["ab", "xy"]} />)
    expect(text()).toBe("ab")
    advance(10_000)
    expect(text()).toBe("ab")
  })
})
