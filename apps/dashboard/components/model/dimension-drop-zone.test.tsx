import { DndContext } from "@dnd-kit/core"
import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { DimensionDropZone } from "@/components/model/dimension-drop-zone"

const build = messages.dashboard.model.build

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
    // question sits next to it rather than in a manual.
    expect(screen.getByRole("button", { name: "Effort" })).toBeDefined()
  })

  it("says how many criteria fit before the dimension is full", () => {
    renderZone({ count: 1, max: 2 }, <p>Analytical effort</p>)
    expect(
      screen.getByText(
        build.zoneCount.replace("{count}", "1").replace("{max}", "2")
      )
    ).toBeDefined()
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
    renderZone({ count: 1 }, <p>Analytical effort</p>)
    expect(screen.queryByRole("img", { name: build.zoneEmpty })).toBeNull()
    expect(screen.getByText("Analytical effort")).toBeDefined()
  })

  // Nothing is in flight, so the zone is at rest: the states that answer a
  // drag are exercised against a real drag in build-dnd-keyboard.test.tsx.
  it("rests until something is dragged", () => {
    renderZone()
    expect(zone().dataset.state).toBe("idle")
  })

  // The count chip is the full state: a dimension reading "2 of max 2" has
  // said it, and repeating it in a second sentence would be one more thing to
  // read on a page made of four of these. What a full zone must not do is keep
  // inviting a drop, which is the drag state the keyboard test pins.
  it("adds nothing to the zone when the dimension fills up", () => {
    const roomy = renderZone({ count: 1, max: 2, full: false }, <p>x</p>)
    const roomyNodes = roomy.container.querySelectorAll("*").length
    cleanup()
    const filled = renderZone({ count: 2, max: 2, full: true }, <p>x</p>)
    expect(filled.container.querySelectorAll("*").length).toBe(roomyNodes)
    expect(
      screen.getByText(
        build.zoneCount.replace("{count}", "2").replace("{max}", "2")
      )
    ).toBeDefined()
  })
})
