import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { StatBar, WidgetCard } from "@/components/widget-card"
import { UserGroupIcon } from "@hugeicons/core-free-icons"

function renderCard(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  )
}

afterEach(cleanup)

describe("WidgetCard", () => {
  // The two shapes the one card takes. With a figure it is a stat tile and
  // the title demotes to the figure's label; without one it is a chart card
  // and the title stays the heading.
  it("labels the figure with the title when there is a value", () => {
    const { container } = renderCard(
      <WidgetCard title="Workforce" value={118} footer="All classified" />
    )
    expect(
      container.querySelector('[data-slot="card-description"]')?.textContent
    ).toBe("Workforce")
    expect(
      container.querySelector('[data-slot="card-title"]')?.textContent
    ).toBe("118")
    expect(
      container.querySelector('[data-slot="card-footer"]')?.textContent
    ).toBe("All classified")
  })

  // The footer is two lines: the statement (how the figure moved, or what
  // state it is in) in foreground weight, then the muted line saying what the
  // figure covers. A delta belongs in the statement, spelled out, not in a
  // pill beside the identity chip.
  it("stacks the statement over its muted note", () => {
    const { container } = renderCard(
      <WidgetCard
        title="People included"
        value={95}
        footer="25 people fewer than 2026"
        note="Everyone included in this pay mapping"
      />
    )
    const footer = container.querySelector('[data-slot="card-footer"]')
    const lines = footer?.children
    expect(lines).toHaveLength(2)
    expect(lines?.[0]?.textContent).toBe("25 people fewer than 2026")
    expect(lines?.[1]?.textContent).toBe(
      "Everyone included in this pay mapping"
    )
    // The statement reads at foreground weight, the note is muted.
    expect(lines?.[0]?.className).toContain("font-medium")
    expect(lines?.[1]?.className).toContain("text-muted-foreground")
  })

  it("renders a note without a statement, and a statement without a note", () => {
    const { container: noteOnly } = renderCard(
      <WidgetCard title="Pay gap" value="3.5%" note="Women vs men" />
    )
    expect(
      noteOnly.querySelector('[data-slot="card-footer"]')?.textContent
    ).toBe("Women vs men")
    cleanup()
    const { container: statementOnly } = renderCard(
      <WidgetCard title="Roles" value={42} footer="12 need a level" />
    )
    expect(
      statementOnly.querySelector('[data-slot="card-footer"]')?.textContent
    ).toBe("12 need a level")
  })

  it("omits the footer entirely when there is neither line", () => {
    const { container } = renderCard(<WidgetCard title="Roles" value={42} />)
    expect(container.querySelector('[data-slot="card-footer"]')).toBeNull()
  })

  // The arrow repeats a direction the statement already spells out, so it is
  // decorative: it exists to survive a glance and greyscale, not to carry the
  // reading.
  it("draws the direction arrow decoratively beside the statement", () => {
    const { container } = renderCard(
      <WidgetCard
        title="People included"
        value={95}
        footer="25 people fewer than 2026"
        footerIcon={UserGroupIcon}
        note="Everyone in this mapping"
      />
    )
    const statement = container.querySelector('[data-slot="card-footer"]')
      ?.children[0]
    const svg = statement?.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute("aria-hidden")).toBe("true")
    // The arrow adds no text, so the statement still reads as one sentence.
    expect(statement?.textContent).toBe("25 people fewer than 2026")
  })

  it("keeps the title as the heading when there is no figure", () => {
    const { container } = renderCard(
      <WidgetCard title="Age distribution">
        <div data-testid="chart" />
      </WidgetCard>
    )
    expect(container.querySelector('[data-slot="card-description"]')).toBeNull()
    expect(
      container.querySelector('[data-slot="card-title"]')?.textContent
    ).toBe("Age distribution")
    expect(screen.getByTestId("chart")).toBeDefined()
  })

  // The whole card is the target, and its accessible name is the title. An
  // sr-only child would have put the title in the text tree twice.
  it("makes the whole card one link named by its title", () => {
    renderCard(<WidgetCard title="Workforce" value={118} href="/people" />)
    const link = screen.getByRole("link", { name: "Workforce" })
    expect(link.getAttribute("href")).toBe("/people")
    expect(screen.getAllByText("Workforce")).toHaveLength(1)
  })

  // A Card clips its overflow and this anchor's box IS the clip edge, so an
  // outward ring is painted away entirely and focus becomes invisible.
  it("draws the link's focus ring inside the clipped card box", () => {
    renderCard(<WidgetCard title="Workforce" value={118} href="/people" />)
    const link = screen.getByRole("link", { name: "Workforce" })
    expect(link.className).toContain("focus-visible:inset-ring-2")
  })

  it("renders the icon chip decoratively, never as the card's name", () => {
    const { container } = renderCard(
      <WidgetCard title="Workforce" icon={UserGroupIcon} value={118} />
    )
    const chip = container.querySelector('[data-slot="card-action"] span')
    expect(chip?.getAttribute("aria-hidden")).toBe("true")
  })

  // A bar's own height is not the slot's height. The wrapper is a flex
  // container, which sizes to its content and has no line box of its own, so
  // without the strut a figure sat in 28px instead of 45 and each footer line
  // in 16 instead of 20: a strip of tiles stood 25px short and everything
  // under it moved when the figures arrived. Measured in headless Chrome,
  // which is the only place it shows, so the test guards the mechanism.
  it("stands a loading bar in the line box its own type would have made", () => {
    const { container } = renderCard(
      <WidgetCard
        title="Workforce"
        value={<StatBar className="h-7 w-16" />}
        footer={<StatBar className="h-4 w-28" />}
      />
    )
    const bars = container.querySelectorAll('[data-slot="skeleton"]')
    expect(bars).toHaveLength(2)
    for (const bar of bars) {
      const strut = bar.previousElementSibling
      // Zero width, so it reinstates the line box without moving the bar.
      expect(strut?.className).toContain("w-0")
      // A non-breaking space: an empty box makes no line box at all.
      expect(strut?.textContent).toBe("\u00a0")
      // No type of its own: it has to INHERIT the size and leading of the slot
      // it sits in, which is what lets one bar fit a 45px figure and a 20px
      // footer line.
      expect(strut?.className).not.toMatch(/\btext-|\bleading-/)
    }
  })

  // A tile's height cannot depend on how long a sentence happens to be in the
  // reader's language. The same note fits one line in Swedish and took two in
  // English and Finnish at the width a 1280px window leaves, which grew the
  // strip by 20px in those locales the moment its figures landed. Both lines
  // are one line, clipped; the copy is written to fit, so the ellipsis is the
  // guard rather than the normal state.
  it("holds each footer line to one line", () => {
    const { container } = renderCard(
      <WidgetCard
        title="Pay gap"
        value="4.2%"
        footer="Down from 4.8% in 2025"
        footerIcon={UserGroupIcon}
        note="Average pay difference, women vs men"
      />
    )
    const footer = container.querySelector('[data-slot="card-footer"]')
    const statement = footer?.children[0]
    const note = footer?.children[1]
    // The statement clips its TEXT, not the row: the direction icon sits
    // outside the clipped box so it cannot be eaten by a long sentence.
    expect(statement?.querySelector(".truncate")?.textContent).toBe(
      "Down from 4.8% in 2025"
    )
    expect(statement?.querySelector("svg")).not.toBeNull()
    expect(note?.className).toContain("truncate")
  })

  it("opens the expanded view from the header control", () => {
    renderCard(
      <WidgetCard
        title="Gender split"
        expandable
        expandedChildren={<div data-testid="expanded" />}
      >
        <div />
      </WidgetCard>
    )
    expect(screen.queryByTestId("expanded")).toBeNull()
    fireEvent.click(
      screen.getByRole("button", { name: messages.dashboard.widgetCard.expand })
    )
    expect(screen.getByTestId("expanded")).toBeDefined()
  })
})
