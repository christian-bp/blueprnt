import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const reducedMotionMock = vi.fn(() => false)
vi.mock("motion/react", () => ({
  useReducedMotion: () => reducedMotionMock(),
}))

import {
  STREAM_REVEAL_CEILING_CHARS_PER_FRAME,
  type StreamRevealPhase,
  useStreamReveal,
} from "@/hooks/use-stream-reveal"

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

function Probe({ text, phase }: { text: string; phase: StreamRevealPhase }) {
  const revealed = useStreamReveal(text, phase)
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
    const { rerender } = render(<Probe text="Hello" phase="streaming" />)
    expect(revealed()).toBe("")

    frame(0)
    const afterFirstFrame = revealed().length
    expect(afterFirstFrame).toBeGreaterThan(0)

    frame(16)
    const afterSecondFrame = revealed().length
    expect(afterSecondFrame).toBeGreaterThanOrEqual(afterFirstFrame)

    rerender(<Probe text="Hello there, friend" phase="streaming" />)
    const beforeGrowth = revealed().length
    frame(32)
    expect(revealed().length).toBeGreaterThanOrEqual(beforeGrowth)
  })

  it("only ever renders a prefix of the arrived text", () => {
    const source = "Streaming reply arriving in one large flush right now"
    render(<Probe text={source} phase="streaming" />)
    for (let i = 0; i < 10 && pending !== undefined; i++) {
      frame(i * 16)
    }
    expect(source.startsWith(revealed())).toBe(true)
    expect(revealed().length).toBeLessThanOrEqual(source.length)
  })

  it("never reveals more than the ceiling's worth of characters in a single frame, even under a huge backlog", () => {
    const longText = "x".repeat(5000)
    render(<Probe text={longText} phase="streaming" />)
    let previousLength = 0
    let now = 0
    for (let i = 0; i < 40; i++) {
      if (pending === undefined) break
      now += 16
      frame(now)
      const currentLength = revealed().length
      expect(currentLength - previousLength).toBeLessThanOrEqual(
        STREAM_REVEAL_CEILING_CHARS_PER_FRAME
      )
      previousLength = currentLength
    }
    // The backlog is nowhere near drained after 40 frames at the ceiling:
    // proof the huge flush is being paced out, not caught up in one jump.
    expect(previousLength).toBeLessThan(longText.length)
  })

  it("keeps pacing at the ceiling instead of snapping when the reply completes with a backlog still pending", () => {
    const source = "x".repeat(200)
    const { rerender } = render(<Probe text={source} phase="streaming" />)
    frame(0)
    const afterFirstFrame = revealed().length
    expect(afterFirstFrame).toBeLessThan(source.length)

    rerender(<Probe text={source} phase="complete" />)
    // Not snapped: the backlog from the streaming phase is still pending.
    expect(revealed().length).toBe(afterFirstFrame)
    expect(pending).toBeDefined()

    frame(16)
    const afterDrainFrame = revealed().length
    expect(afterDrainFrame).toBeGreaterThan(afterFirstFrame)
    expect(afterDrainFrame - afterFirstFrame).toBeLessThanOrEqual(
      STREAM_REVEAL_CEILING_CHARS_PER_FRAME
    )
    expect(afterDrainFrame).toBeLessThan(source.length)
  })

  it.each(["stopped", "failed"] as const)(
    "snaps to the full text immediately when the reply ends %s",
    (endPhase) => {
      const source = "This will be cut off before it all arrives"
      const { rerender } = render(<Probe text={source} phase="streaming" />)
      frame(0)
      expect(revealed()).not.toBe(source)

      rerender(<Probe text={source} phase={endPhase} />)
      expect(revealed()).toBe(source)
      expect(pending).toBeUndefined()
    }
  )

  it("renders arrivals as-is under reduced motion, with no frame pacing", () => {
    reducedMotionMock.mockReturnValue(true)
    const source = "Whole thing shows at once"
    render(<Probe text={source} phase="streaming" />)
    expect(revealed()).toBe(source)
    expect(pending).toBeUndefined()
  })

  it("never paces the completion drain under reduced motion either", () => {
    reducedMotionMock.mockReturnValue(true)
    const source = "Whole thing shows at once, no draining under reduced motion"
    const { rerender } = render(<Probe text={source} phase="streaming" />)
    expect(revealed()).toBe(source)

    rerender(<Probe text={source} phase="complete" />)
    expect(revealed()).toBe(source)
    expect(pending).toBeUndefined()
  })

  it("cancels the pending frame on unmount", () => {
    const { unmount } = render(
      <Probe text="Some streaming text still arriving" phase="streaming" />
    )
    frame(0)
    expect(pending).toBeDefined()

    unmount()
    expect(cancelCount).toBeGreaterThan(0)
    expect(pending).toBeUndefined()
  })
})
