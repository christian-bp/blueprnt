import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import { WeightPointRow } from "@/components/model/weight-point-row"

const build = messages.dashboard.model.weighting

function renderRow(value: number, onChange = vi.fn(), disabled = false) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WeightPointRow
        name="Problem solving"
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    </NextIntlClientProvider>
  )
  return {
    onChange,
    group: screen.getByRole("group", {
      name: build.setWeightPoints.replace("{name}", "Problem solving"),
    }),
  }
}

describe("WeightPointRow", () => {
  afterEach(cleanup)

  // The allocation is 1-5 weight points under a fixed budget (ADR-0004), so
  // the control offers exactly the five values and nothing in between. They
  // run low to high, the direction every other scale in the product reads,
  // including this row's own hover copy.
  it("offers the five weight points ascending and presses the current one", () => {
    const { group } = renderRow(4)
    const options = within(group).getAllByRole("button")
    expect(options.map((option) => option.textContent)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ])
    expect(
      options.map((option) => option.getAttribute("aria-pressed"))
    ).toEqual(["false", "false", "false", "true", "false"])
  })

  it("reports the point the user picked", () => {
    const { group, onChange } = renderRow(4)
    fireEvent.click(within(group).getByRole("button", { name: "2" }))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it("takes no input while the allocation is being saved", () => {
    const { group, onChange } = renderRow(4, vi.fn(), true)
    for (const option of within(group).getAllByRole("button")) {
      expect((option as HTMLButtonElement).disabled).toBe(true)
    }
    fireEvent.click(within(group).getByRole("button", { name: "2" }))
    expect(onChange).not.toHaveBeenCalled()
  })

  // Five buttons stretched across a full-width column read as five separate
  // controls rather than as one 1-5 scale, so the row stops at 20rem. w-full
  // under the cap is what keeps it filling a narrow card, and neither mx-auto
  // nor a self-centring class: it stays at the card's left edge while the card
  // grows past it.
  it("caps its width and stays left-aligned", () => {
    const { group } = renderRow(3)
    expect(group.className).toContain("max-w-xs")
    expect(group.className).toContain("w-full")
    expect(group.className).not.toContain("mx-auto")
  })

  // The meaning is asserted VISIBLE, not merely mounted: presence in the DOM
  // does not prove the panel can be read, since a panel can be mounted and
  // still hidden. Motion settles its opacity in this environment, which is
  // what makes "visible" checkable here at all. The tooltip IS the animated
  // box: one element carries the surface, the placement and the slide.
  const meaningBox = () => screen.getByRole("tooltip")

  it("slides a step's own meaning out on hover, and hides it again on leave", async () => {
    const { group } = renderRow(3)
    expect(screen.queryByRole("tooltip")).toBeNull()

    fireEvent.mouseEnter(within(group).getByRole("button", { name: "1" }))
    expect(screen.getByRole("tooltip").textContent).toBe(build.weightMeaning1)
    await waitFor(() => {
      expect(meaningBox().style.opacity).toBe("1")
    })

    // Leaving the BAR closes it, not leaving one segment: sliding from step
    // to step keeps the panel up and only swaps its text, which is what makes
    // the five meanings readable in one pass.
    fireEvent.mouseEnter(within(group).getByRole("button", { name: "2" }))
    expect(screen.getByRole("tooltip").textContent).toBe(build.weightMeaning2)
    fireEvent.mouseLeave(group)
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull()
    })
  })

  // The dismiss handler sits on a wrapper that CONTAINS both the segments and
  // the panel, never on a segment alone: a reveal the pointer cannot travel
  // into is a reveal that cannot be read, which is exactly how v1 failed.
  it("keeps the panel inside the element that dismisses it", () => {
    const { group } = renderRow(3)
    fireEvent.mouseEnter(within(group).getByRole("button", { name: "3" }))
    expect(group.contains(screen.getByRole("tooltip"))).toBe(true)
  })

  // The panel is a SURFACE, not styled text. The defect this pins: the
  // background, border and width once sat on an inline <span> inside the
  // animated box, where width does not apply, vertical padding overflows
  // instead of growing the box, and the background paints per line fragment.
  // The reader got a few white strips with the card's own title and
  // description showing between them. "Becomes visible" never caught it,
  // because the opacity was 1 throughout: the assertion has to be that the
  // panel is an opaque box.
  it("draws the meaning on an opaque popover surface", () => {
    const { group } = renderRow(3)
    fireEvent.mouseEnter(within(group).getByRole("button", { name: "3" }))
    const panel = screen.getByRole("tooltip")
    // A block box, never an inline one.
    expect(panel.tagName).toBe("DIV")
    const tokens = panel.className.split(/\s+/)
    // Opaque ground and a contour of its own, layered over the card text it
    // covers.
    expect(tokens).toContain("bg-popover")
    expect(tokens).toContain("border")
    expect(tokens).toContain("z-30")
    // The width the collision math was given (PANEL_WIDTH 224 = w-56), and the
    // padding that keeps the text off the border.
    expect(tokens).toContain("w-56")
    expect(tokens).toContain("p-3")
    // ButtonGroup joins its children by data-slot, and the panel is one of
    // them: carrying that attribute would flatten the last step's corner and
    // drop its left border.
    expect(panel.getAttribute("data-slot")).toBeNull()
  })

  it("reveals the meaning on focus too, not hover only", async () => {
    const { group } = renderRow(3)
    fireEvent.focus(within(group).getByRole("button", { name: "4" }))
    expect(screen.getByRole("tooltip").textContent).toBe(build.weightMeaning4)
    await waitFor(() => {
      expect(meaningBox().style.opacity).toBe("1")
    })
  })

  // Each step explains ITSELF: the per-step copy this row has always carried
  // on its five buttons, kept through the gauge rework.
  it("gives every step its own meaning, stacked over the row", () => {
    const { group } = renderRow(3)
    for (const option of [1, 2, 3, 4, 5]) {
      fireEvent.mouseEnter(
        within(group).getByRole("button", { name: String(option) })
      )
      expect(screen.getByRole("tooltip").textContent).toBe(
        build[`weightMeaning${option}` as keyof typeof build]
      )
      // One panel, stacked clear of the row. WHICH side it takes is the
      // collision math's answer and is pinned by the placement tests below,
      // against real geometry; here the point is that every step explains
      // itself.
      const style = meaningBox().style
      expect([style.bottom, style.top]).toContain("100%")
    }
  })

  // The step on screen is the described one, so a screen reader gets the
  // explanation with the step instead of as a separate stop.
  it("describes the step it is explaining", () => {
    const { group } = renderRow(3)
    const step = within(group).getByRole("button", { name: "2" })
    expect(step.getAttribute("aria-describedby")).toBeNull()
    fireEvent.focus(step)
    expect(step.getAttribute("aria-describedby")).toBe(
      screen.getByRole("tooltip").id
    )
  })

  // The row is a pure discrete gauge: ascending left to right, filled up to
  // the value, and the LAST FILLED step is the value. The visual encoding is
  // the fill's boundary; the semantic one is aria-pressed, asserted at the
  // foot of this test, because a boundary between five identical buttons is
  // not something a screen reader can announce.
  it("fills up to the value, with the last filled step as the value", () => {
    const { group } = renderRow(3)
    const steps = within(group).getAllByRole("button")
    expect(steps.map((b) => b.textContent)).toEqual(["1", "2", "3", "4", "5"])

    // Every step the level reaches wears ONE wash, the value included.
    expect(steps.map((b) => b.className.includes("bg-brand/10"))).toEqual([
      true,
      true,
      true,
      false,
      false,
    ])
    // The value is the last FILLED step and carries NO marker of its own: the
    // three washed steps are one and the same button, class for class, so the
    // only thing that says "3" is where the wash ends. A marker would say the
    // value is a different kind of thing from the level it ends.
    expect(new Set(steps.slice(0, 3).map((b) => b.className)).size).toBe(1)
    // One ink across the washed steps, and it is the dark step of the brand:
    // --brand itself measures 3.42:1 on this wash, the edge ink 6.35:1, and a
    // step number is small text.
    expect(steps.map((b) => b.className.includes("text-brand-edge"))).toEqual([
      true,
      true,
      true,
      false,
      false,
    ])
    // Steps ABOVE it stay neutral: no wash.
    for (const step of steps.slice(3)) {
      expect(step.className).not.toContain("bg-brand/10")
    }
    // No selection marker of any kind survives on any step: not a brand block,
    // not a second fill weight, not an edge on the value.
    for (const step of steps) {
      expect(step.className).not.toContain("bg-primary")
      expect(step.className).not.toContain("bg-brand/30")
      expect(step.className).not.toContain("border-brand-edge")
    }
    // Only the value is pressed. This is the ONLY encoding of the chosen point
    // outside the fill's boundary, so it is the one an assistive reader has.
    expect(steps.map((b) => b.getAttribute("aria-pressed"))).toEqual([
      "false",
      "false",
      "true",
      "false",
      "false",
    ])
  })

  // The one reading of the row, as an array rather than indexed lookups: how
  // far the wash runs. There is nothing else on a step to read.
  const washed = (steps: HTMLElement[]) =>
    steps.map((step) => step.className.includes("bg-brand/10"))
  // What the row SAYS is set, which after the marker retired is carried by
  // aria-pressed alone. A preview must never move it.
  const pressed = (steps: HTMLElement[]) =>
    steps.map((step) => step.getAttribute("aria-pressed") === "true")

  // Hovering a step previews its click: the boundary moves to THAT step, so
  // the level is visible before it is set. Only the boundary moves, and what
  // is SET does not: aria-pressed stays on 3 throughout.
  it("previews the fill under the pointer, and retracts on leave", () => {
    const { group } = renderRow(3)
    const steps = within(group).getAllByRole("button")
    expect(washed(steps)).toEqual([true, true, true, false, false])

    fireEvent.mouseEnter(within(group).getByRole("button", { name: "5" }))
    expect(washed(steps)).toEqual([true, true, true, true, true])
    expect(pressed(steps)).toEqual([false, false, true, false, false])
    // A previewed step is the committed one's equal, class for class: the
    // preview is a picture of the level, and drawing 3 differently under it
    // would put the retired selection marker back.
    expect(new Set(steps.map((b) => b.className)).size).toBe(1)

    // Downward as well: hovering 1 previews dropping to 1, so the wash above
    // it goes. A preview that only ever grew would misreport every reduction.
    fireEvent.mouseEnter(within(group).getByRole("button", { name: "1" }))
    expect(washed(steps)).toEqual([true, false, false, false, false])
    expect(pressed(steps)).toEqual([false, false, true, false, false])

    fireEvent.mouseLeave(group)
    expect(washed(steps)).toEqual([true, true, true, false, false])
  })

  // A preview only a pointer can see is no preview at all for a keyboard
  // reader: the same gesture that opens the meaning moves the fill.
  it("previews on keyboard focus too, and retracts on blur", () => {
    const { group } = renderRow(3)
    const steps = within(group).getAllByRole("button")
    const step5 = within(group).getByRole("button", { name: "5" })

    fireEvent.focus(step5)
    expect(washed(steps)).toEqual([true, true, true, true, true])
    expect(pressed(steps)).toEqual([false, false, true, false, false])

    fireEvent.blur(step5)
    expect(washed(steps)).toEqual([true, true, true, false, false])
  })

  // The row's and the steps' boxes drive the collision math, so they are
  // given real ones: happy-dom reports every rect as zero.
  function withRowAt(
    row: { left: number; right: number; top: number; bottom: number },
    viewport: { width: number; height: number },
    run: () => void
  ) {
    const originalRect = Element.prototype.getBoundingClientRect
    const originalW = window.innerWidth
    const originalH = window.innerHeight
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: viewport.width,
    })
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: viewport.height,
    })
    // Five equal steps across the row, so a step's rect is its own slice.
    const stepWidth = (row.right - row.left) / 5
    Element.prototype.getBoundingClientRect = function measured(this: Element) {
      if (this.className.includes("max-w-xs")) {
        return { ...row, width: row.right - row.left, height: 32 } as DOMRect
      }
      if (this.tagName === "BUTTON") {
        const index = Number(this.textContent) - 1
        const left = row.left + index * stepWidth
        return {
          left,
          right: left + stepWidth,
          top: row.top,
          bottom: row.bottom,
          width: stepWidth,
          height: 32,
        } as DOMRect
      }
      return {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        width: 0,
        height: 64,
      } as DOMRect
    }
    try {
      run()
    } finally {
      Element.prototype.getBoundingClientRect = originalRect
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalW,
      })
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: originalH,
      })
    }
  }

  const meaningStyle = () => screen.getByRole("tooltip").style

  // The meaning opens ABOVE the step it explains, centred on it.
  it("opens above the step, centred on it", () => {
    withRowAt(
      { left: 400, right: 720, top: 500, bottom: 532 },
      { width: 1440, height: 900 },
      () => {
        const { group } = renderRow(3)
        fireEvent.mouseEnter(within(group).getByRole("button", { name: "3" }))
        const style = meaningStyle()
        expect(style.bottom).toBe("100%")
        expect(style.top).toBe("")
        // Step 3 spans 528-592, centre 560; the panel is 224 wide, so its left
        // edge sits 224/2 left of that, in the row's own coordinates.
        expect(style.left).toBe(`${560 - 400 - 112}px`)
      }
    )
  })

  // A row near the top of the viewport has nothing above it, so the meaning
  // drops below rather than opening off screen.
  it("flips below when the top would leave the viewport", () => {
    withRowAt(
      { left: 400, right: 720, top: 20, bottom: 52 },
      { width: 1440, height: 900 },
      () => {
        const { group } = renderRow(3)
        fireEvent.mouseEnter(within(group).getByRole("button", { name: "3" }))
        const style = meaningStyle()
        expect(style.top).toBe("100%")
        expect(style.bottom).toBe("")
      }
    )
  })

  // A step against the page's right edge: the centred panel would hang off, so
  // it slides left just enough to stay inside.
  it("slides sideways to stay inside the viewport's edge", () => {
    withRowAt(
      { left: 1100, right: 1420, top: 500, bottom: 532 },
      { width: 1440, height: 900 },
      () => {
        const { group } = renderRow(3)
        fireEvent.mouseEnter(within(group).getByRole("button", { name: "5" }))
        // Step 5 spans 1356-1420, centre 1388; centred the panel would run to
        // 1500, past 1440-8, so it slides left and lands exactly on the margin.
        const left = Number.parseFloat(meaningStyle().left)
        expect(left + 1100 + 224).toBe(1440 - 8)
      }
    )
  })

  // Every step must occupy an IDENTICAL box: the button base clips its
  // background to the padding box, so a filled step wearing the base's
  // transparent border paints smaller than the bordered steps beside it and
  // reads as a dent in the row. Each step therefore carries a real border, and
  // none falls back to the transparent one.
  it("gives every step the same box, the selected one included", () => {
    const { group } = renderRow(3)
    const steps = within(group).getAllByRole("button")
    for (const step of steps) {
      expect(step.className).not.toContain("border-transparent")
    }
    // One real border each, and only two kinds of them: the fill's on the
    // washed steps, the neutral one above. The value shares the fill's border
    // with the steps under it, like everything else about it.
    expect(
      steps.map((step) =>
        ["border-brand/40", "border-border"].find((token) =>
          step.className.includes(token)
        )
      )
    ).toEqual([
      "border-brand/40",
      "border-brand/40",
      "border-brand/40",
      "border-border",
      "border-border",
    ])
  })
})
