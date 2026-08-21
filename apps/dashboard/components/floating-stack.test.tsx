import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { FloatingPill, FloatingPillText } from "@/components/floating-pill"
import {
  FloatingStack,
  FloatingStackProvider,
} from "@/components/floating-stack"
import { SectionTitleRow } from "@/components/section-title-row"

afterEach(cleanup)

const railOf = (container: HTMLElement) =>
  container.querySelector('[data-slot="floating-stack"]') as HTMLElement

describe("FloatingStack", () => {
  // The instrument is the stack's persistent BASE and a chapter's pills stack
  // above it, so the reading a section always has sits closest to the edge and
  // what a chapter has to say arrives on top of it.
  it("keeps the instrument at the base and stacks pills above it", () => {
    const { container } = render(
      <FloatingStackProvider>
        <FloatingPill tone="info">
          <FloatingPillText alone>Two criteria left</FloatingPillText>
        </FloatingPill>
        <FloatingStack instrument={<div data-testid="instrument" />} />
      </FloatingStackProvider>
    )
    const rail = railOf(container)
    const flow = [
      ...rail.querySelectorAll(
        '[data-slot="floating-pill"], [data-testid="instrument"]'
      ),
    ]
    expect(
      flow.map(
        (node) =>
          node.getAttribute("data-slot") ?? node.getAttribute("data-testid")
      )
    ).toEqual(["floating-pill", "instrument"])
  })

  // The instrument is persistent: a section with nothing to say still shows
  // where it stands, which is the whole reason it moved down here.
  it("shows the instrument with no pill in the stack", () => {
    const { container } = render(
      <FloatingStackProvider>
        <FloatingStack instrument={<div data-testid="instrument" />} />
      </FloatingStackProvider>
    )
    expect(screen.getByTestId("instrument")).toBeDefined()
    expect(
      railOf(container).querySelector('[data-slot="floating-pill"]')
    ).toBeNull()
  })

  // Fixed, bottom-centre, above the page and below the toast layer: the same
  // corner and the same z the chapter pills already used on their own, so
  // nothing moved for anyone when the instrument joined them.
  it("floats out of flow, bottom-centre, under the toasts", () => {
    const { container } = render(
      <FloatingStackProvider>
        <FloatingStack instrument={<div data-testid="instrument" />} />
      </FloatingStackProvider>
    )
    const tokens = railOf(container).className.split(/\s+/)
    expect(tokens).toContain("fixed")
    expect(tokens).toContain("bottom-6")
    expect(tokens).toContain("z-40")
    expect(tokens).toContain("items-center")
    // A clear gap between a chapter's pill and the instrument: they are two
    // readings of different scopes, and sitting tight they read as one object
    // with a strip attached.
    expect(tokens).toContain("gap-3")
    // Nothing in the rail takes the pointer unless a pill opts back in, so
    // content underneath stays reachable through it.
    expect(tokens).toContain("pointer-events-none")
  })
})

describe("SectionTitleRow", () => {
  // Drift pin: the reading floats now. A title row that grew an instrument
  // slot back would put the section's state at a scroll position again.
  it("carries the title and its help, and no reading of its own", () => {
    const { container } = render(
      <SectionTitleRow
        heading="Model"
        help={<button type="button">?</button>}
      />
    )
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Model")
    expect(container.querySelector('[role="progressbar"]')).toBeNull()
    expect(container.querySelector('[class*="fixed"]')).toBeNull()
    expect(container.textContent).toBe("Model?")
  })
})
