import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { DimensionColumn } from "@/components/model/dimension-column"

const criteria = messages.dashboard.model.criteria
const help = messages.dashboard.help

const countChip = (count: number, max: number) =>
  screen.getByText(
    criteria.zoneCount
      .replace("{count}", String(count))
      .replace("{max}", String(max))
  )

function renderColumn(
  props: Partial<Parameters<typeof DimensionColumn>[0]> = {},
  children?: ReactNode
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DimensionColumn
        title="Effort"
        helpBody="What does the work demand of the person doing it?"
        count={0}
        max={2}
        full={false}
        action={<button type="button">Add criterion</button>}
        {...props}
      >
        {children}
      </DimensionColumn>
    </NextIntlClientProvider>
  )
}

const column = () => screen.getByRole("region", { name: "Effort" })

describe("DimensionColumn", () => {
  afterEach(cleanup)

  it("names the dimension and explains it in place", () => {
    renderColumn()
    expect(column()).toBeDefined()
    // The dimension is a domain term the surface introduces, so its guiding
    // question sits next to it rather than in a manual. The trigger is named
    // after what it answers: named after the dimension it would be the third
    // node on the row answering to "Effort", and the first two are the region
    // and the heading.
    expect(
      screen.getByRole("button", { name: help.dimensionLabel })
    ).toBeDefined()
  })

  it("says how many criteria fit before the dimension is full", () => {
    renderColumn({ count: 1, max: 2 }, <li>Analytical effort</li>)
    expect(countChip(1, 2)).toBeDefined()
  })

  // The column owns the <ul>, so a chosen card is a list item in a list
  // wherever the view mounts it, rather than an orphan <li> the caller had to
  // remember to wrap.
  it("holds its criteria in a list of its own", () => {
    const { container } = renderColumn({ count: 1 }, <li>Analytical effort</li>)
    const list = container.querySelector("ul")
    expect(list).not.toBeNull()
    expect(list?.querySelectorAll("li")).toHaveLength(1)
  })

  // The hatch is the app's one "empty slot" statement (the level ladder's
  // empty rows wear it too), so an empty column reads as a container waiting
  // to be filled rather than as a card that failed to render.
  it("fills an empty column with the shared hatch", () => {
    const { container } = renderColumn({ count: 0 })
    const empty = screen.getByRole("img", { name: criteria.zoneEmpty })
    expect(empty.className).toContain("repeating-linear-gradient")
    // The size pin that keeps the hatch crisp in WebKit travels with it.
    expect(container.querySelector('[class*="background-size:"]')).toBe(empty)
  })

  it("drops the hatch as soon as the dimension holds a criterion", () => {
    renderColumn({ count: 1 }, <li>Analytical effort</li>)
    expect(screen.queryByRole("img", { name: criteria.zoneEmpty })).toBeNull()
    expect(screen.getByText("Analytical effort")).toBeDefined()
  })

  // The way to add sits OUTSIDE the box, under it: adding a criterion grows
  // the box, and a control inside would move under the reader's own pointer
  // the moment they used it.
  it("keeps the way to add outside the box it fills", () => {
    renderColumn()
    const add = screen.getByRole("button", { name: "Add criterion" })
    expect(column().contains(add)).toBe(false)
  })

  // A full dimension SHOWS it: the count chip fills in and the column itself
  // carries the state, so "2 of max 2" reads as complete at a glance instead
  // of as two numbers to compare. It says so without adding a node, because a
  // column that grew a line when it filled would shift under the reader.
  it("reads as complete when the dimension fills up, without growing", () => {
    const roomy = renderColumn({ count: 1, max: 2, full: false }, <li>x</li>)
    const roomyNodes = roomy.container.querySelectorAll("*").length
    expect(column().dataset.full).toBe("false")
    expect(countChip(1, 2).dataset.variant).toBe("outline")
    cleanup()
    const filled = renderColumn({ count: 2, max: 2, full: true }, <li>x</li>)
    expect(filled.container.querySelectorAll("*").length).toBe(roomyNodes)
    expect(column().dataset.full).toBe("true")
    expect(countChip(2, 2).dataset.variant).toBe("secondary")
  })
})
