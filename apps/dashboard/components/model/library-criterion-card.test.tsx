import { DndContext } from "@dnd-kit/core"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  type LibraryCardEntry,
  LibraryCriterionCard,
} from "@/components/model/library-criterion-card"

const build = messages.dashboard.model.build

const ENTRY: LibraryCardEntry = {
  libraryKey: "analytical-effort",
  dimensionKey: "effort",
  name: "Analytical effort",
  shortUiText: "How much analysis the work demands",
}

function renderCard(
  props: Partial<Parameters<typeof LibraryCriterionCard>[0]> = {}
) {
  const onAdd = props.onAdd ?? vi.fn()
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DndContext>
        <ul>
          <LibraryCriterionCard entry={ENTRY} {...props} onAdd={onAdd} />
        </ul>
      </DndContext>
    </NextIntlClientProvider>
  )
  return { onAdd }
}

const addButton = () =>
  screen.getByRole("button", {
    name: build.addLabel.replace("{name}", ENTRY.name),
  })

const dragBody = () =>
  screen.getByRole("button", {
    name: build.dragLabel.replace("{name}", ENTRY.name),
  })

describe("LibraryCriterionCard", () => {
  afterEach(cleanup)

  it("shows the criterion and what it measures", () => {
    renderCard()
    expect(screen.getByText(ENTRY.name)).toBeDefined()
    expect(screen.getByText(ENTRY.shortUiText)).toBeDefined()
  })

  // Click-to-add is not a fallback for the drag, it is the same action by
  // another route, so it is always present and never behind a menu.
  it("adds the criterion from the card's own button", () => {
    const { onAdd } = renderCard()
    fireEvent.click(addButton())
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  // Several of these sit on screen at once, so "Add" alone would leave a
  // screen reader with a list of identical buttons.
  it("names the criterion in both of its controls", () => {
    renderCard()
    expect(addButton().textContent).toContain(build.addCta)
    expect(dragBody()).toBeDefined()
  })

  it("marks a criterion the industry hints recommend", () => {
    renderCard({ recommended: true })
    expect(screen.getByText(build.recommendedChip)).toBeDefined()
  })

  it("says nothing about industry fit when there is no hint", () => {
    renderCard()
    expect(screen.queryByText(build.recommendedChip)).toBeNull()
  })

  // The overlap warning names what it overlaps WITH. "Overlaps something" is
  // a warning the reader cannot act on.
  it("warns about overlap with the criteria already chosen", () => {
    renderCard({ overlapsSelected: ["Complexity", "Scope and impact"] })
    expect(
      screen.getByText(
        build.overlapChip.replace("{names}", "Complexity & Scope and impact")
      )
    ).toBeDefined()
  })

  // Flows state their preconditions in words rather than presenting a dead
  // control with no explanation.
  it("explains in words why a card cannot be added right now", () => {
    const { onAdd } = renderCard({
      dimmedReason: "This dimension already holds 2 criteria.",
    })
    expect(
      screen.getByText("This dimension already holds 2 criteria.")
    ).toBeDefined()
    const add = addButton() as HTMLButtonElement
    expect(add.disabled).toBe(true)
    fireEvent.click(add)
    expect(onAdd).not.toHaveBeenCalled()
    // The other route in is closed too, or the drag would do what the button
    // refuses.
    expect(dragBody().getAttribute("aria-disabled")).toBe("true")
  })

  it("stays draggable while it can still be added", () => {
    renderCard()
    expect(dragBody().getAttribute("aria-disabled")).toBe("false")
  })
})
