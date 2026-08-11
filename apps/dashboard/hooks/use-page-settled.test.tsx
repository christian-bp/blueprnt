import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { usePageSettled } from "@/hooks/use-page-settled"

// The hook's clock is the frame, so the test owns the frames: a driver that
// hands out timestamps instead of a real rAF is what lets a janky page and a
// calm one be told apart deterministically, rather than by hoping the machine
// running the suite is busy.
let pending: FrameRequestCallback | undefined

function frame(at: number) {
  const callback = pending
  pending = undefined
  if (callback === undefined) throw new Error("no frame was requested")
  act(() => {
    callback(at)
  })
}

function Probe({ loaded }: { loaded: boolean }) {
  return <span data-testid="settled">{String(usePageSettled(loaded))}</span>
}

function settled(): string {
  return screen.getByTestId("settled").textContent ?? ""
}

describe("usePageSettled", () => {
  beforeEach(() => {
    pending = undefined
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      pending = callback
      return 1
    })
    vi.stubGlobal("cancelAnimationFrame", () => {
      pending = undefined
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  // Nothing to wait for yet, and nothing measured: an unloaded page must not
  // even start counting, or the count would be against the load itself.
  it("stays false while the page is still loading", () => {
    render(<Probe loaded={false} />)
    expect(settled()).toBe("false")
    expect(pending).toBeUndefined()
  })

  it("turns true once frames come back on time", () => {
    render(<Probe loaded={true} />)
    frame(0) // the first frame has no delta to measure
    expect(settled()).toBe("false")
    frame(16)
    expect(settled()).toBe("false") // one quiet frame is not calm yet
    frame(32)
    expect(settled()).toBe("true")
  })

  // The whole point: frames that arrive late mean the main thread is busy, and
  // an animation started there would run its course inside the jank.
  it("keeps waiting while frames arrive late", () => {
    render(<Probe loaded={true} />)
    frame(0)
    frame(400)
    frame(700)
    expect(settled()).toBe("false")
    frame(716)
    frame(732)
    expect(settled()).toBe("true")
  })

  // A page that never goes quiet still gets its moment; losing it entirely is
  // worse than starting it into a busy frame.
  it("gives up waiting at the ceiling", () => {
    render(<Probe loaded={true} />)
    frame(0)
    frame(400)
    frame(800)
    expect(settled()).toBe("false")
    frame(1200)
    expect(settled()).toBe("true")
  })

  // Switching company puts every query back in flight, so the next arrival is
  // measured from scratch rather than inheriting the previous one's answer.
  it("goes back to false when the page reloads", () => {
    const { rerender } = render(<Probe loaded={true} />)
    frame(0)
    frame(16)
    frame(32)
    expect(settled()).toBe("true")

    rerender(<Probe loaded={false} />)
    expect(settled()).toBe("false")

    rerender(<Probe loaded={true} />)
    frame(0)
    frame(16)
    frame(32)
    expect(settled()).toBe("true")
  })
})
