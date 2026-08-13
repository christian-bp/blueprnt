import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const reducedMotionMock = vi.fn(() => false)
vi.mock("motion/react", () => ({
  useReducedMotion: () => reducedMotionMock(),
}))

import { useStreamReveal } from "@/hooks/use-stream-reveal"

// The hook's clock is the frame: a driver that hands out timestamps instead
// of a real rAF is what lets backlog catch-up be measured deterministically,
// rather than by hoping the machine running the suite is fast enough.
let pending: FrameRequestCallback | undefined
let cancelCount = 0

function frame(at: number) {
  const callback = pending
  pending = undefined
  if (callback === undefined) throw new Error("no frame was requested")
  act(() => {
    callback(at)
  })
}

function Probe({ text, streaming }: { text: string; streaming: boolean }) {
  const revealed = useStreamReveal(text, streaming)
  return <span data-testid="revealed">{revealed}</span>
}

function revealed(): string {
  return screen.getByTestId("revealed").textContent ?? ""
}

describe("useStreamReveal", () => {
  beforeEach(() => {
    pending = undefined
    cancelCount = 0
    reducedMotionMock.mockReturnValue(false)
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      pending = callback
      return 1
    })
    vi.stubGlobal("cancelAnimationFrame", () => {
      pending = undefined
      cancelCount += 1
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("grows the revealed prefix monotonically, never shrinking, as more text arrives", () => {
    const { rerender } = render(<Probe text="Hello" streaming={true} />)
    expect(revealed()).toBe("")

    frame(0)
    const afterFirstFrame = revealed().length
    expect(afterFirstFrame).toBeGreaterThan(0)

    frame(16)
    const afterSecondFrame = revealed().length
    expect(afterSecondFrame).toBeGreaterThanOrEqual(afterFirstFrame)

    rerender(<Probe text="Hello there, friend" streaming={true} />)
    const beforeGrowth = revealed().length
    frame(32)
    expect(revealed().length).toBeGreaterThanOrEqual(beforeGrowth)
  })

  it("only ever renders a prefix of the arrived text", () => {
    const source = "Streaming reply arriving in one large flush right now"
    render(<Probe text={source} streaming={true} />)
    for (let i = 0; i < 10 && pending !== undefined; i++) {
      frame(i * 16)
    }
    expect(source.startsWith(revealed())).toBe(true)
    expect(revealed().length).toBeLessThanOrEqual(source.length)
  })

  it("catches a large backlog up well inside the catch-up window instead of trailing arrival", () => {
    const longText = "x".repeat(500)
    render(<Probe text={longText} streaming={true} />)
    let now = 0
    for (let i = 0; i < 60; i++) {
      if (pending === undefined) break
      now += 16
      frame(now)
    }
    expect(revealed()).toBe(longText)
    // Generous margin over the ~400ms catch-up target: the point is that it
    // finishes fast, not that the reply trails arrival indefinitely.
    expect(now).toBeLessThanOrEqual(600)
  })

  it("snaps to the full text immediately once streaming flips false", () => {
    const source = "This will be cut off before it all arrives"
    const { rerender } = render(<Probe text={source} streaming={true} />)
    frame(0)
    expect(revealed()).not.toBe(source)

    rerender(<Probe text={source} streaming={false} />)
    expect(revealed()).toBe(source)
  })

  it("renders arrivals as-is under reduced motion, with no frame pacing", () => {
    reducedMotionMock.mockReturnValue(true)
    const source = "Whole thing shows at once"
    render(<Probe text={source} streaming={true} />)
    expect(revealed()).toBe(source)
    expect(pending).toBeUndefined()
  })

  it("cancels the pending frame on unmount", () => {
    const { unmount } = render(
      <Probe text="Some streaming text still arriving" streaming={true} />
    )
    frame(0)
    expect(pending).toBeDefined()

    unmount()
    expect(cancelCount).toBeGreaterThan(0)
    expect(pending).toBeUndefined()
  })
})
