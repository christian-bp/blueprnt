import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { FloatingPill, FloatingPillText } from "@/components/floating-pill"
import {
  FloatingStack,
  FloatingStackProvider,
} from "@/components/floating-stack"

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
