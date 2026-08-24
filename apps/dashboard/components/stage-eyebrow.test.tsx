import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { STAGE_EYEBROW_CLASS, StageEyebrow } from "@/components/stage-eyebrow"

describe("StageEyebrow", () => {
  afterEach(() => cleanup())

  // Announced, not aria-hidden. It was hidden at first, and that left the
  // stage announced to nobody on the model shell, which has no breadcrumb and
  // whose heading only reads "Chapters". A reader using a screen reader needs
  // to know which stage they are in as much as anyone.
  it("is announced rather than hidden", () => {
    render(<StageEyebrow label="Method" />)
    const eyebrow = screen.getByText("Method")
    expect(eyebrow.getAttribute("aria-hidden")).toBeNull()
  })

  // A SCANNED label, which is the reading floor's own eyebrow exception: this
  // is the one place text-xs is correct for something that is not a badge or a
  // timestamp. A future edit that "fixed" it up to text-sm would be undoing
  // the decision, not the defect.
  it("stays a scanned uppercase label, not running text", () => {
    render(<StageEyebrow label="Method" />)
    const className = screen.getByText("Method").className
    expect(className).toContain("text-xs")
    expect(className).toContain("uppercase")
    expect(className).toContain("tracking-wide")
  })

  // One behaviour, one class string. Two modes of one label is the drift this
  // shared component exists to prevent, so the exported constant and what the
  // component renders can never be two different treatments.
  it("renders exactly the shared class every surface imports", () => {
    render(<StageEyebrow label="Assessment" />)
    expect(screen.getByText("Assessment").className).toBe(STAGE_EYEBROW_CLASS)
  })
})
