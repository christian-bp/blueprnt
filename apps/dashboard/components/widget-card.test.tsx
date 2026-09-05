import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import {
  StatBar,
  useWidgetExpanded,
  WidgetCard,
} from "@/components/widget-card"
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
  // The two shapes the one card takes. With a figure it is a stat tile: the
  // title takes the first line on its own and the figure sits on the row
  // below with its qualifying line above it. Without a figure it is a chart
  // card and the title stays the heading.
  it("names the tile on the first line and prints the figure on the row below", () => {
    const { container } = renderCard(
      <WidgetCard title="Workforce" value={118} note="All classified" />
    )
    const panel = container.querySelector('[data-slot="frame-panel"]')
    expect(panel?.children).toHaveLength(2)
    expect(panel?.children[0]?.textContent).toBe("Workforce")
    // The line qualifies the figure, so it travels with it rather than with
    // the name: label above, number below, on the same row.
    expect(panel?.children[1]?.textContent).toBe("All classified118")
  })

  // ONE qualifying line, and it is meta rather than running text: the
  // standing explainer of what a figure is belongs in the tile's help.
  it("reads the qualifying line as muted meta under the label", () => {
    renderCard(<WidgetCard title="Pay gap" value="3.5%" note="vs 2025" />)
    const note = screen.getByText("vs 2025")
    expect(note.className).toContain("text-muted-foreground")
    // Clipped to one line: a tile's height cannot depend on how long the
    // same phrase happens to be in the reader's language, and the same note
    // fits one line in Swedish and took two in English and Finnish at the
    // width a 1280px window leaves.
    expect(note.className).toContain("truncate")
  })

  it("omits the line entirely when the tile has none", () => {
    const { container } = renderCard(<WidgetCard title="Roles" value={42} />)
    const head = container.querySelector('[data-slot="frame-panel"]')
      ?.children[0]
    expect(head?.textContent).toBe("Roles")
  })

  // One reading per row: how the figure moved sits on the name line, and the
  // figure's own history sits beside the figure.
  it("puts the movement on the name line and the history beside the figure", () => {
    const { container } = renderCard(
      <WidgetCard
        title="Pay gap"
        value="13.7%"
        note="vs 2025"
        headerExtra={<span data-testid="chip">-0.5 pp</span>}
        trailing={<span data-testid="spark" />}
      />
    )
    const panel = container.querySelector('[data-slot="frame-panel"]')
    expect(
      panel?.children[0]?.querySelector('[data-testid="chip"]')
    ).not.toBeNull()
    expect(
      panel?.children[1]?.querySelector('[data-testid="spark"]')
    ).not.toBeNull()
  })

  it("keeps the title as the heading when there is no figure", () => {
    const { container } = renderCard(
      <WidgetCard title="Age distribution">
        <div data-testid="chart" />
      </WidgetCard>
    )
    expect(
      container.querySelector('[data-slot="card-title"]')?.textContent
    ).toBe("Age distribution")
    expect(screen.getByTestId("chart")).toBeDefined()
  })

  // A chart card keeps a footer, because what qualifies a picture is a
  // statement rather than a label: the statement in foreground weight, then
  // the muted line under it.
  it("stacks a chart card's statement over its muted note", () => {
    const { container } = renderCard(
      <WidgetCard
        title="Pay gap over time"
        footer="Down from 4.8% in 2025"
        note="Average pay difference, women vs men"
      >
        <div />
      </WidgetCard>
    )
    const lines = container.querySelector('[data-slot="card-footer"]')?.children
    expect(lines).toHaveLength(2)
    expect(lines?.[0]?.textContent).toBe("Down from 4.8% in 2025")
    expect(lines?.[0]?.className).toContain("font-medium")
    expect(lines?.[1]?.className).toContain("text-muted-foreground")
    // Each line is one line, clipped: same reason as the stat tile's note.
    expect(lines?.[0]?.querySelector(".truncate")?.textContent).toBe(
      "Down from 4.8% in 2025"
    )
    expect(lines?.[1]?.className).toContain("truncate")
  })

  // The arrow repeats a direction the statement already spells out, so it is
  // decorative: it exists to survive a glance and greyscale, not to carry the
  // reading.
  it("draws the direction arrow decoratively beside the statement", () => {
    const { container } = renderCard(
      <WidgetCard
        title="Pay gap over time"
        footer="Down from 4.8% in 2025"
        footerIcon={UserGroupIcon}
      >
        <div />
      </WidgetCard>
    )
    const statement = container.querySelector('[data-slot="card-footer"]')
      ?.children[0]
    const svg = statement?.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute("aria-hidden")).toBe("true")
    // The arrow adds no text, so the statement still reads as one sentence.
    expect(statement?.textContent).toBe("Down from 4.8% in 2025")
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
    const chip = container.querySelector(
      '[data-slot="frame-panel"] span[aria-hidden="true"]'
    )
    expect(chip?.querySelector("svg")).not.toBeNull()
    expect(screen.getAllByText("Workforce")).toHaveLength(1)
  })

  // A bar's own height is not the slot's height. The wrapper is a flex
  // container, which sizes to its content and has no line box of its own, so
  // without the strut a figure sat in a 28px bar's height instead of its
  // type's 28px line box and the note in 16 instead of its own: a strip of
  // tiles stood short and everything under it moved when the figures
  // arrived. Measured in headless Chrome, which is the only place it shows,
  // so the test guards the mechanism.
  it("stands a loading bar in the line box its own type would have made", () => {
    const { container } = renderCard(
      <WidgetCard
        title="Workforce"
        value={<StatBar className="h-7 w-16" />}
        note={<StatBar className="h-4 w-28" />}
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
      // it sits in, which is what lets one bar fit the figure and the next
      // fit the note line.
      expect(strut?.className).not.toMatch(/\btext-|\bleading-/)
    }
  })

  it("opens the expanded view from the header control", () => {
    renderCard(
      <WidgetCard title="Gender split" expandable>
        <div data-testid="body" />
      </WidgetCard>
    )
    expect(screen.getAllByTestId("body")).toHaveLength(1)
    fireEvent.click(
      screen.getByRole("button", { name: messages.dashboard.widgetCard.expand })
    )
    // The same children, now rendered in the dialog as well as in the card.
    expect(screen.getAllByTestId("body").length).toBeGreaterThan(1)
  })

  // Expanding is a request for a BIGGER canvas. A chart whose height is a
  // fixed class renders at exactly the same size in the dialog, which is what
  // made expanding feel broken on a large screen: it gained width and not one
  // pixel of height. The flag travels by context so a card never has to
  // render its children twice, once with a size prop set.
  it("tells the expanded rendering that it is expanded, and the card that it is not", () => {
    function Probe() {
      return <span data-testid="probe">{String(useWidgetExpanded())}</span>
    }
    renderCard(
      <WidgetCard title="Gender split" expandable>
        <Probe />
      </WidgetCard>
    )
    expect(
      screen.getAllByTestId("probe").map((node) => node.textContent)
    ).toEqual(["false"])
    fireEvent.click(
      screen.getByRole("button", { name: messages.dashboard.widgetCard.expand })
    )
    expect(
      screen.getAllByTestId("probe").map((node) => node.textContent)
    ).toEqual(["false", "true"])
  })

  // Expanding must not cost the reader the chart's own controls: the dialog
  // is where they actually work with it.
  it("carries the header controls into the expanded dialog", () => {
    renderCard(
      <WidgetCard
        title="Gender split"
        expandable
        headerExtra={<button type="button">Roll</button>}
      >
        <div />
      </WidgetCard>
    )
    expect(screen.getByRole("button", { name: "Roll" })).toBeDefined()
    fireEvent.click(
      screen.getByRole("button", { name: messages.dashboard.widgetCard.expand })
    )
    // The dialog takes the page out of the accessibility tree, so the control
    // the reader can still reach has to be the dialog's own copy.
    expect(
      screen
        .getByRole("button", { name: "Roll" })
        .closest('[data-slot="dialog-content"]')
    ).not.toBeNull()
  })

  // The cap used to be a fixed 5xl (1024px), which is narrower than the page
  // behind it on any large monitor: expanding a chart there made it smaller.
  it("sizes the expanded dialog to the screen rather than to a fixed step", () => {
    renderCard(
      <WidgetCard title="Gender split" expandable>
        <div />
      </WidgetCard>
    )
    fireEvent.click(
      screen.getByRole("button", { name: messages.dashboard.widgetCard.expand })
    )
    const dialog = document.querySelector('[data-slot="dialog-content"]')
    const classes = dialog?.getAttribute("class") ?? ""
    expect(classes).toContain("100vw")
    // And it stays inside the viewport, so a tall chart cannot push the
    // dialog's own header off screen.
    expect(classes).toContain("max-h-")
    expect(classes).toContain("overflow-y-auto")
  })
})
