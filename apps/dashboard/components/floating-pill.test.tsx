import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { FloatingPill, FloatingPillText } from "@/components/floating-pill"
import { WARNING_ALERT_CLASS } from "@/lib/alert-tone"

const pill = (container: HTMLElement) =>
  container.querySelector('[data-slot="floating-pill"]') as HTMLElement | null

describe("FloatingPill", () => {
  afterEach(cleanup)

  // Fixed and out of flow, which is the whole reason a chapter's standing
  // readout floats: nothing it says can push the grid below the framing row.
  it("floats out of the page's flow, under the toasts", () => {
    const { container } = render(
      <FloatingPill tone="info">
        <FloatingPillText alone>Two criteria left</FloatingPillText>
      </FloatingPill>
    )
    const rail = container.firstElementChild as HTMLElement
    const classes = rail.className.split(/\s+/)
    expect(classes).toContain("fixed")
    // Above the page, below the toast layer (z-50), so a save's confirmation
    // is never covered by the pill it replaces.
    expect(classes).toContain("z-40")
    expect(classes).toContain("pointer-events-none")
    expect(pill(container)?.className).toContain("pointer-events-auto")
  })

  // A polite live region, so the readings it carries (points left, over
  // budget, ready to save, what remains to choose) reach a screen reader as
  // they change. Polite and not assertive: the reader is driving the changes
  // themselves, and an assertive region interrupts them with their own edit.
  it("announces politely, as a status region", () => {
    const { container } = render(
      <FloatingPill tone="info">
        <FloatingPillText alone>Two criteria left</FloatingPillText>
      </FloatingPill>
    )
    expect(pill(container)?.getAttribute("role")).toBe("status")
    expect(screen.getByRole("status").textContent).toBe("Two criteria left")
  })

  // Nothing to say, nothing on screen: the quiet state is the steady state of
  // a finished chapter, and a pill standing there to confirm it is one more
  // thing to look past.
  it("renders nothing at all when there is nothing to say", () => {
    const { container } = render(
      <FloatingPill tone="info">{null}</FloatingPill>
    )
    expect(pill(container)).toBeNull()
    expect(screen.queryByRole("img")).toBeNull()
  })

  // Unfinished and WRONG must not read alike: only the warning tints the box,
  // and it takes the app's one amber rather than an amber of its own.
  it("tints only the warning tone, in the app's own amber", () => {
    const { container: warning } = render(
      <FloatingPill tone="warning">
        <FloatingPillText alone>Over the budget</FloatingPillText>
      </FloatingPill>
    )
    expect(pill(warning)?.className.split(/\s+/)).toEqual(
      expect.arrayContaining(WARNING_ALERT_CLASS.split(/\s+/))
    )
    cleanup()

    for (const tone of ["info", "ready"] as const) {
      const { container } = render(
        <FloatingPill tone={tone}>
          <FloatingPillText alone>Steady</FloatingPillText>
        </FloatingPill>
      )
      expect(pill(container)?.className).not.toContain("amber")
      expect(pill(container)?.getAttribute("data-tone")).toBe(tone)
      cleanup()
    }
  })

  // Every tone carries its own mark, so the state survives greyscale and a
  // reader who does not separate the tints.
  it("marks every tone with an icon", () => {
    for (const tone of ["info", "warning", "ready"] as const) {
      const { container } = render(
        <FloatingPill tone={tone}>
          <FloatingPillText alone>Something</FloatingPillText>
        </FloatingPill>
      )
      expect(pill(container)?.querySelector("svg")).not.toBeNull()
      cleanup()
    }
  })
})
