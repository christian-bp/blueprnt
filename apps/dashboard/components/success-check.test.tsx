import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// Only the reduced-motion hook is stubbed; the real motion components still
// render, so the assertions run against the markup the app ships.
const reducedMotionMock = vi.fn(() => false)
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => reducedMotionMock(),
}))

import { CONFETTI, SuccessCheck } from "./success-check"

afterEach(() => {
  cleanup()
  reducedMotionMock.mockReturnValue(false)
})

function confettiPieces(container: HTMLElement): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(
      '[data-testid="success-confetti"] > span'
    ),
  ]
}

describe("SuccessCheck", () => {
  it("renders a decorative (aria-hidden) success badge with a check icon", () => {
    const { container } = render(<SuccessCheck />)
    const badge = container.querySelector('[aria-hidden="true"]')
    expect(badge).not.toBeNull()
    expect(badge?.querySelector("svg")).not.toBeNull()
  })

  it("throws a confetti burst, one element per piece", () => {
    const { container } = render(<SuccessCheck />)
    expect(confettiPieces(container)).toHaveLength(CONFETTI.length)
  })

  it("spreads the burst evenly across the palette", () => {
    const perColor = new Map<string, number>()
    for (const piece of CONFETTI) {
      perColor.set(piece.color, (perColor.get(piece.color) ?? 0) + 1)
    }
    // Every palette step, in equal shares. The burst is built per color for
    // exactly this reason: an uneven draw would let one tint dominate and the
    // whole thing would read as a single flat color.
    expect(perColor.size).toBe(5)
    expect(new Set(perColor.values()).size).toBe(1)
  })

  it("starts the ripple and every piece hidden so their delays are not visible", () => {
    const { container } = render(<SuccessCheck />)
    const ripple = container.querySelector<HTMLElement>(
      '[data-testid="success-ripple"]'
    )
    // Both wait on the badge's impact. Held at their animated value instead of
    // at zero opacity, they would sit parked under the badge until their turn.
    expect(ripple?.style.opacity).toBe("0")
    for (const piece of confettiPieces(container)) {
      expect(piece.style.opacity).toBe("0")
    }
  })

  it("renders no confetti under reduced motion", () => {
    reducedMotionMock.mockReturnValue(true)
    const { container } = render(<SuccessCheck />)
    expect(
      container.querySelector('[data-testid="success-confetti"]')
    ).toBeNull()
  })
})
