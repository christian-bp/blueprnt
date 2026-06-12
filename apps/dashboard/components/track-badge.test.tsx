import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { TrackBadge } from "@/components/track-badge"

describe("TrackBadge", () => {
  afterEach(() => {
    cleanup()
  })

  function badgeAround(text: string): HTMLElement {
    const badge = screen.getByText(text).closest("[data-slot=badge]")
    if (!(badge instanceof HTMLElement)) throw new Error("badge not found")
    return badge
  }

  it("renders the track name with a tint for known keys", () => {
    render(<TrackBadge trackKey="IC" name="Individual contributor" />)
    expect(badgeAround("Individual contributor").className).toContain(
      "bg-sky-50"
    )
  })

  it("renders both the full name and the short key responsively", () => {
    render(<TrackBadge trackKey="IC" name="Individual contributor" />)
    // Full name hides below md; the key shows only below md.
    expect(screen.getByText("Individual contributor").className).toContain(
      "max-md:hidden"
    )
    expect(screen.getByText("IC").className).toContain("md:hidden")
  })

  it("falls back to the plain outline badge for unknown keys", () => {
    render(<TrackBadge trackKey="Specialist" name="Specialist Name" />)
    const badge = badgeAround("Specialist Name")
    expect(badge.className).not.toContain("bg-sky-50")
    expect(badge.className).not.toContain("bg-violet-50")
    expect(badge.className).not.toContain("bg-amber-50")
  })
})
