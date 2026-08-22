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
  // The rail carries a chapter's pills and nothing else.
  it("carries the chapter's pill", () => {
    const { container } = render(
      <FloatingStackProvider>
        <FloatingPill tone="info">
          <FloatingPillText alone>Two criteria left</FloatingPillText>
        </FloatingPill>
        <FloatingStack />
      </FloatingStackProvider>
    )
    const rail = railOf(container)
    expect(rail.querySelector('[data-slot="floating-pill"]')).not.toBeNull()
    // Never the journey instrument: that sits centred on the section's title
    // row, where it does not pass over the reader's data.
    expect(rail.querySelector('[role="progressbar"]')).toBeNull()
  })

  // Nothing at all when nothing has anything to say: a section whose open
  // chapter carries no pill should leave no fixed element behind, empty or
  // not.
  it("mounts nothing when the stack is empty", () => {
    const { container } = render(
      <FloatingStackProvider>
        <FloatingStack />
      </FloatingStackProvider>
    )
    expect(railOf(container)).toBeNull()
  })

  // Fixed, bottom-centre, above the page and below the toast layer: the same
  // corner and the same z the chapter pills already used on their own, so
  // nothing moved for anyone when the instrument joined them.
  it("floats out of flow, bottom-centre, under the toasts", () => {
    const { container } = render(
      <FloatingStackProvider>
        <FloatingPill tone="info">
          <FloatingPillText alone>Two criteria left</FloatingPillText>
        </FloatingPill>
        <FloatingStack />
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
  // Right-aligned opposite the title, at every width the two fit on one line,
  // and on its own right-aligned line below md. The class set IS the
  // arrangement, so it is what gets pinned: jsdom cannot measure the boxes
  // these rules produce.
  it("right-aligns the instrument opposite the title", () => {
    const { container } = render(
      <SectionTitleRow
        heading="Model"
        help={<button type="button">?</button>}
        instrument={<div data-testid="instrument" />}
      />
    )
    const rowTokens = (
      container.firstElementChild as HTMLElement
    ).className.split(/\s+/)
    const tokens = (
      screen.getByTestId("instrument").parentElement as HTMLElement
    ).className.split(/\s+/)

    // One line while they fit: the title owns the start, the instrument the
    // end, so neither can land on the other whatever the locale or the
    // sidebar does to the row's width.
    expect(tokens).toContain("md:ms-auto")
    expect(tokens).toContain("md:w-auto")

    // Below md it wraps to its own line, right-aligned there too.
    expect(rowTokens).toContain("flex-wrap")
    expect(tokens).toContain("w-full")
    expect(tokens).toContain("justify-end")

    // Never centred and never absolute: page-centring is what put the
    // instrument over the title at every width below 2xl.
    expect(tokens).not.toContain("justify-center")
    expect(rowTokens.some((token) => token.endsWith("grid"))).toBe(false)
    expect(tokens.some((token) => token.endsWith("absolute"))).toBe(false)
  })

  // Drift pin: the instrument is NOT in the floating stack. It passed over the
  // reader's data there, which is what brought it back up.
  it("carries the title and its help, and floats nothing", () => {
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
