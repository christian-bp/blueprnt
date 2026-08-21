import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { DimensionFrame } from "@/components/model/dimension-frame"

const frame = (container: HTMLElement) =>
  container.querySelector('[data-slot="dimension-frame"]') as HTMLElement

describe("DimensionFrame", () => {
  afterEach(cleanup)

  // The dashed box is the app's "this container takes something" language, and
  // it is declared once here so a later tweak cannot land on two chapters and
  // miss the third.
  it("draws the dashed dimension box", () => {
    const { container } = render(
      <DimensionFrame heading={<h3>Effort</h3>}>
        <p>body</p>
      </DimensionFrame>
    )
    expect(frame(container).tagName).toBe("SECTION")
    const tokens = frame(container).className.split(/\s+/)
    expect(tokens).toContain("border-dashed")
    expect(tokens).toContain("rounded-xl")
  })

  // A named region: on a four-column surface, jumping straight to a dimension
  // is how a screen-reader user gets to the one they want.
  it("names the column after its heading row", () => {
    render(
      <DimensionFrame heading={<h3>Effort</h3>}>
        <p>body</p>
      </DimensionFrame>
    )
    expect(screen.getByRole("region", { name: "Effort" })).toBeDefined()
  })

  // Where the heading row carries more than the title (Kriterier puts a help
  // trigger and a count chip in it), the caller points the name at the title
  // itself, so neither ends up read out as part of the dimension's name.
  it("defers to the caller's own title id when given one", () => {
    render(
      <DimensionFrame
        headingId="title-1"
        heading={
          <>
            <h3 id="title-1">Effort</h3>
            <span>2 of max 3</span>
          </>
        }
      >
        <p>body</p>
      </DimensionFrame>
    )
    expect(screen.getByRole("region", { name: "Effort" })).toBeDefined()
    expect(screen.queryByRole("region", { name: /2 of max 3/ })).toBeNull()
  })

  // The footer is the column's own last row (the Kriterier add row), inside
  // the box. A frame with nothing to put there grows no empty slot.
  it("renders the footer row only when there is one", () => {
    const { container, rerender } = render(
      <DimensionFrame
        heading={<h3>Effort</h3>}
        footer={<button type="button">Add</button>}
      >
        <p>body</p>
      </DimensionFrame>
    )
    expect(screen.getByRole("button", { name: "Add" })).toBeDefined()
    const withFooter = frame(container).childElementCount
    rerender(
      <DimensionFrame heading={<h3>Effort</h3>}>
        <p>body</p>
      </DimensionFrame>
    )
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull()
    expect(frame(container).childElementCount).toBe(withFooter - 1)
  })
})
