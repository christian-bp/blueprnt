import { DndContext } from "@dnd-kit/core"
import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { DimensionDropZone } from "@/components/model/dimension-drop-zone"

const build = messages.dashboard.model.build
const help = messages.dashboard.help

const countChip = (count: number, max: number) =>
  screen.getByText(
    build.zoneCount
      .replace("{count}", String(count))
      .replace("{max}", String(max))
  )

function renderZone(
  props: Partial<Parameters<typeof DimensionDropZone>[0]> = {},
  children?: ReactNode
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {/* The zone is a droppable, so it only ever renders inside the build
          view's drag context. */}
      <DndContext>
        <DimensionDropZone
          dimensionKey="effort"
          title="Effort"
          helpBody="What does the work demand of the person doing it?"
          count={0}
          max={2}
          full={false}
          {...props}
        >
          {children}
        </DimensionDropZone>
      </DndContext>
    </NextIntlClientProvider>
  )
}

const zone = () => screen.getByRole("region", { name: "Effort" })

describe("DimensionDropZone", () => {
  afterEach(cleanup)

  it("names the dimension and explains it in place", () => {
    renderZone()
    expect(zone()).toBeDefined()
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
    renderZone({ count: 1, max: 2 }, <li>Analytical effort</li>)
    expect(countChip(1, 2)).toBeDefined()
  })

  // The zone owns the <ul>, so a placed card is a list item in a list wherever
  // the view mounts it, rather than an orphan <li> the caller had to remember
  // to wrap.
  it("holds its criteria in a list of its own", () => {
    const { container } = renderZone({ count: 1 }, <li>Analytical effort</li>)
    const list = container.querySelector("ul")
    expect(list).not.toBeNull()
    expect(list?.querySelectorAll("li")).toHaveLength(1)
  })

  // The hatch is the app's one "empty slot" statement (the level ladder's
  // empty rows wear it too), so an empty zone reads as a container waiting to
  // be filled rather than as a card that failed to render.
  it("fills an empty zone with the shared hatch", () => {
    const { container } = renderZone({ count: 0 })
    const empty = screen.getByRole("img", { name: build.zoneEmpty })
    expect(empty.className).toContain("repeating-linear-gradient")
    // The size pin that keeps the hatch crisp in WebKit travels with it.
    expect(container.querySelector('[class*="background-size:"]')).toBe(empty)
  })

  it("drops the hatch as soon as the dimension holds a criterion", () => {
    renderZone({ count: 1 }, <li>Analytical effort</li>)
    expect(screen.queryByRole("img", { name: build.zoneEmpty })).toBeNull()
    expect(screen.getByText("Analytical effort")).toBeDefined()
  })

  // Nothing is in flight, so the zone is at rest: the states that answer a
  // drag are exercised against a real drag in build-dnd-keyboard.test.tsx.
  it("rests until something is dragged", () => {
    renderZone()
    expect(zone().dataset.state).toBe("idle")
  })

  // A full dimension SHOWS it: the count chip fills in and the zone itself
  // carries the state, so "2 of max 2" reads as complete at a glance instead
  // of as two numbers to compare. It says so without adding a node, because a
  // zone that grew a line when it filled would shift its whole column under
  // the reader.
  it("reads as complete when the dimension fills up, without growing", () => {
    const roomy = renderZone({ count: 1, max: 2, full: false }, <li>x</li>)
    const roomyNodes = roomy.container.querySelectorAll("*").length
    expect(zone().dataset.full).toBe("false")
    expect(countChip(1, 2).dataset.variant).toBe("outline")
    cleanup()
    const filled = renderZone({ count: 2, max: 2, full: true }, <li>x</li>)
    expect(filled.container.querySelectorAll("*").length).toBe(roomyNodes)
    expect(zone().dataset.full).toBe("true")
    expect(countChip(2, 2).dataset.variant).toBe("secondary")
  })
})
