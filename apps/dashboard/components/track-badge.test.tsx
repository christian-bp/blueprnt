import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { TrackBadge } from "@/components/track-badge"

describe("TrackBadge", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the track name with a tint for known keys", () => {
    render(<TrackBadge trackKey="IC" name="Individual contributor" />)
    const badge = screen.getByText("Individual contributor")
    expect(badge.className).toContain("bg-sky-50")
  })

  it("falls back to the plain outline badge for unknown keys", () => {
    render(<TrackBadge trackKey="Specialist" name="Specialist" />)
    const badge = screen.getByText("Specialist")
    expect(badge.className).not.toContain("bg-sky-50")
    expect(badge.className).not.toContain("bg-violet-50")
    expect(badge.className).not.toContain("bg-amber-50")
  })
})
