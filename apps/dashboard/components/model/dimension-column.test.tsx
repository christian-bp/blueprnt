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
    criteria.columnCount
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
    const empty = screen.getByRole("img", { name: criteria.columnEmpty })
    expect(empty.className).toContain("repeating-linear-gradient")
    // The size pin that keeps the hatch crisp in WebKit travels with it.
    expect(container.querySelector('[class*="background-size:"]')).toBe(empty)
  })

  it("drops the hatch as soon as the dimension holds a criterion", () => {
    renderColumn({ count: 1 }, <li>Analytical effort</li>)
    expect(screen.queryByRole("img", { name: criteria.columnEmpty })).toBeNull()
    expect(screen.getByText("Analytical effort")).toBeDefined()
  })

  // The way to add is the column's own last row, inside the card that holds
  // its criteria: adding is this column's work, and a control parked outside
  // the box read as page furniture rather than as the column's next line.
  it("carries the way to add as its own last row, inside the card", () => {
    renderColumn({ count: 1 }, <li>Analytical effort</li>)
    const add = screen.getByRole("button", { name: "Add criterion" })
    expect(column().contains(add)).toBe(true)
    // After the criteria, never before them.
    const list = column().querySelector("ul") as HTMLElement
    expect(
      list.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  // The empty column keeps both: the hatch standing in for the criteria it has
  // none of, and the add row beneath it.
  it("keeps the add row under the hatch while the column is empty", () => {
    renderColumn({ count: 0 })
    const hatch = screen.getByRole("img", { name: criteria.columnEmpty })
    const add = screen.getByRole("button", { name: "Add criterion" })
    expect(column().contains(add)).toBe(true)
    expect(
      hatch.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  // A full dimension simply has no add row: no disabled control, and no
  // sentence explaining the cap. The count chip and the dimension's help carry
  // it instead; no prose renders.
  it("drops the add row, silently, when the dimension is full", () => {
    renderColumn(
      { count: 2, max: 2, full: true, action: undefined },
      <li>x</li>
    )
    expect(screen.queryByRole("button", { name: "Add criterion" })).toBeNull()
    // The chip still says it, and the help is still reachable.
    expect(countChip(2, 2).dataset.variant).toBe("secondary")
    expect(
      screen.getByRole("button", { name: help.dimensionLabel })
    ).toBeDefined()
  })

  // A column that has EXPLAINED its own emptiness does not also need the
  // hatch: "nothing here yet" is the wrong story under a note that just said
  // why, so the note stands exactly where the hatch was.
  it("takes the hatch off an explained column and stands its note where it was", () => {
    renderColumn({
      count: 0,
      explained: true,
      action: undefined,
      note: <p>Tested, not material</p>,
    })
    expect(screen.queryByRole("img", { name: criteria.columnEmpty })).toBeNull()
    expect(screen.queryByRole("button", { name: "Add criterion" })).toBeNull()
    expect(screen.getByText("Tested, not material")).toBeDefined()
  })

  // Explained is not the same as closed: a column can say why it is empty and
  // still take a criterion, which is exactly the state a dimension decided
  // material but not yet staffed sits in. The hatch and the add row are two
  // different questions, and only the first is this prop's.
  it("keeps the add row on an explained column that still takes something", () => {
    renderColumn({ count: 0, explained: true, note: <p>Decided active</p> })
    expect(screen.queryByRole("img", { name: criteria.columnEmpty })).toBeNull()
    expect(screen.getByRole("button", { name: "Add criterion" })).toBeDefined()
    expect(screen.getByText("Decided active")).toBeDefined()
  })

  // A note that is only a PROMPT settles nothing: the column still takes a
  // criterion, so it keeps both the hatch and the add row.
  it("keeps the hatch and the add row while the note is only a prompt", () => {
    renderColumn({ count: 0, note: <p>Test materiality</p> })
    expect(
      screen.getByRole("img", { name: criteria.columnEmpty })
    ).toBeDefined()
    expect(screen.getByRole("button", { name: "Add criterion" })).toBeDefined()
    expect(screen.getByText("Test materiality")).toBeDefined()
  })

  // An EMPTY column's note LEADS: it is the context for the emptiness under
  // it, and a slot whose explanation sits below it reads backwards (a dashed
  // box first, what it is for second). Decision, then place, then action.
  it("leads an empty column with its note, above the hatch and the add row", () => {
    renderColumn({ count: 0, note: <p>Decided material</p> })
    const note = screen.getByText("Decided material")
    const hatch = screen.getByRole("img", { name: criteria.columnEmpty })
    const add = screen.getByRole("button", { name: "Add criterion" })
    expect(
      note.compareDocumentPosition(hatch) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      hatch.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  // A FILLED column turns it around: there the criteria are the content and
  // the note is their footnote, so it follows them.
  it("puts the note under the criteria and above the add row", () => {
    renderColumn({ count: 1, note: <p>note</p> }, <li>Analytical effort</li>)
    const note = screen.getByText("note")
    const list = column().querySelector("ul") as HTMLElement
    const add = screen.getByRole("button", { name: "Add criterion" })
    expect(
      list.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      note.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
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
