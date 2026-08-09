import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// Only the reduced-motion hook is stubbed; the real motion components still
// render, so the assertions run against the markup the app ships.
const reducedMotionMock = vi.fn(() => false)
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => reducedMotionMock(),
}))

import { CONFETTI, ConfettiBurst } from "./confetti-burst"
import { SuccessCheck } from "./success-check"

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

describe("ConfettiBurst edge origin", () => {
  // Every piece starts where its own ray leaves the box, so at least one of
  // its two coordinates is pinned to a border. Inside-the-box origins would
  // mean the burst erupts through whatever the card is showing.
  // Within a rounding error of the border, not exactly on it: the dominant
  // axis is cos/|cos| = 1 in real arithmetic and 0.9999999999999999 in
  // floating point.
  const onBorder = (value: number) =>
    Math.abs(value) < 1e-9 || Math.abs(value - 100) < 1e-9

  it("puts every piece on the border of its box", () => {
    for (const piece of CONFETTI) {
      const onVertical = onBorder(piece.edgeX)
      const onHorizontal = onBorder(piece.edgeY)
      expect(onVertical || onHorizontal).toBe(true)
      expect(piece.edgeX).toBeGreaterThanOrEqual(0)
      expect(piece.edgeX).toBeLessThanOrEqual(100)
      expect(piece.edgeY).toBeGreaterThanOrEqual(0)
      expect(piece.edgeY).toBeLessThanOrEqual(100)
    }
  })

  // All four edges throw. A burst that left one side of the card bare would
  // read as a mistake rather than as an effect.
  it("throws from all four edges", () => {
    const edges = new Set(
      CONFETTI.map((piece) =>
        Math.abs(piece.edgeX) < 1e-9
          ? "left"
          : Math.abs(piece.edgeX - 100) < 1e-9
            ? "right"
            : Math.abs(piece.edgeY) < 1e-9
              ? "top"
              : "bottom"
      )
    )
    expect(edges).toEqual(new Set(["left", "right", "top", "bottom"]))
  })

  it("renders the pieces at those origins, not at the center", () => {
    const { container } = render(<ConfettiBurst origin="edges" />)
    const pieces = confettiPieces(container)
    expect(pieces).toHaveLength(CONFETTI.length)
    const centered = pieces.filter(
      (piece) => piece.style.left === "50%" && piece.style.top === "50%"
    )
    expect(centered).toHaveLength(0)
  })
})

describe("ConfettiBurst intensity", () => {
  it("throws every piece at full intensity", () => {
    const { container } = render(<ConfettiBurst />)
    expect(confettiPieces(container)).toHaveLength(CONFETTI.length)
  })

  // Fewer pieces, not the same burst scaled: forty-five smaller pieces still
  // read as a party.
  it("thins the burst when soft", () => {
    const { container } = render(<ConfettiBurst intensity="soft" />)
    const pieces = confettiPieces(container)
    expect(pieces.length).toBeLessThan(CONFETTI.length)
    expect(pieces.length).toBeGreaterThan(0)
  })

  // Thinned by index, so the palette stays even: slicing the front of the
  // list would drop whole colors and leave a bare arc.
  it("keeps every color in the soft burst", () => {
    const kept = CONFETTI.filter((_, index) => index % 2 === 0)
    expect(new Set(kept.map((piece) => piece.color)).size).toBe(5)
  })
})
