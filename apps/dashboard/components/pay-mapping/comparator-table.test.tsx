import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ComparatorTable } from "@/components/pay-mapping/comparator-table"
import type { WomenDominatedComparisonWire } from "@/components/pay-mapping/pay-mapping-gap-types"

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", role: "admin" }),
}))

afterEach(cleanup)

function comparison(
  overrides: Partial<WomenDominatedComparisonWire> = {}
): WomenDominatedComparisonWire {
  return {
    key: "IT Manager|5",
    roleTitle: "IT Manager",
    seniority: null,
    level: 5,
    headcount: 1,
    womenSharePct: 0,
    meanComp: 73174,
    diffPct: 7.1,
    diffSek: 4843,
    ...overrides,
  }
}

// The women-dominated group every comparator is measured against.
const BASELINE = {
  roleTitle: "Nurse",
  seniority: null,
  level: 3,
  headcount: 10,
  womenSharePct: 90,
  meanComp: 40000,
}

function renderTable(
  props: Partial<Parameters<typeof ComparatorTable>[0]> = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ComparatorTable
        baseline={BASELINE}
        comparisons={[comparison()]}
        currency="SEK"
        {...props}
      />
    </NextIntlClientProvider>
  )
}

// A header count that does not match the cell count silently shifts every
// column after the mismatch: the row's "..." menu rendered under the
// "Pay affected by" heading, and the trailing heading sat over nothing.
// table-fixed makes this invisible in a screenshot until you read the
// heading above the control, so it is pinned here rather than by eye.
describe("ComparatorTable columns", () => {
  // Per ROW, not across the body: the table leads with the baseline row and
  // then lists the comparators, so a body-wide count would pass while one
  // row was short.
  function cellsPerRow(container: HTMLElement): number[] {
    return [...container.querySelectorAll("tbody tr")].map(
      (row) => row.querySelectorAll("td").length
    )
  }

  it("gives every heading a cell in every row when there is no documentation", () => {
    const { container } = renderTable()
    const headings = container.querySelectorAll("thead th").length
    expect(cellsPerRow(container)).toEqual([headings, headings])
  })

  // The disclosure column appears only when rows can open, so it is a third
  // shape the header/cell parity has to hold for. An expanded row is exempt:
  // it is one cell spanning the table on purpose.
  it("gives every heading a cell in every row when rows can be expanded", () => {
    const { container } = renderTable({
      documentation: {
        runId: "run1" as never,
        groupKey: "Product Manager|5",
        actions: [],
        notes: [],
        locked: false,
      },
      renderExpanded: () => <p>panel</p>,
    })
    const headings = container.querySelectorAll("thead th").length
    expect(cellsPerRow(container)).toEqual([headings, headings])
  })

  it("gives every heading a cell in every row when documentation is shown", () => {
    const { container } = renderTable({
      documentation: {
        runId: "run1" as never,
        groupKey: "Product Manager|5",
        actions: [],
        notes: [],
        locked: false,
      },
    })
    const headings = container.querySelectorAll("thead th").length
    expect(cellsPerRow(container)).toEqual([headings, headings])
  })

  // The expanded row is the one row exempt from the parity check above, so
  // its span is what has to hold instead: one short and the panel leaves a
  // stray empty cell at the end of the table, one long and it widens the row
  // past every heading.
  it("spans the expanded panel across exactly every column", () => {
    const { container } = renderTable({
      documentation: {
        runId: "run1" as never,
        groupKey: "Product Manager|5",
        actions: [],
        notes: [],
        locked: false,
      },
      selectedKey: "IT Manager|5",
      onSelect: vi.fn(),
      renderExpanded: () => <p>panel</p>,
    })
    const headings = container.querySelectorAll("thead th").length
    const panel = screen.getByText("panel").closest("td")
    expect(panel?.getAttribute("colspan")).toBe(String(headings))
  })

  it("puts the row menu in its own column, not under a value heading", () => {
    const { container } = renderTable({
      documentation: {
        runId: "run1" as never,
        groupKey: "Product Manager|5",
        actions: [],
        notes: [],
        locked: false,
      },
    })
    // The comparator row, not the baseline: the baseline carries no menu.
    const rows = [...container.querySelectorAll("tbody tr")]
    const comparatorRow = rows[rows.length - 1] as HTMLElement
    const cells = [...comparatorRow.querySelectorAll("td")]
    const menuIndex = cells.findIndex(
      (cell) => within(cell as HTMLElement).queryByRole("button") !== null
    )
    const headings = [...container.querySelectorAll("thead th")]
    // The menu's own heading is screen-reader only: a menu is something you
    // do, not a value a column names.
    expect(headings[menuIndex]?.textContent).toBe(
      messages.dashboard.payMapping.detail.comparators.actions
    )
    expect(headings[menuIndex]?.querySelector(".sr-only")).not.toBeNull()
  })

  // The reference row has to LOOK like the reference. Its weight lives on the
  // row; per-cell font classes beat it and rendered it at the comparison
  // rows' own weight, with nothing on screen saying which row was which.
  it("carries its heavier weight on the reference row, not against it", () => {
    const { container } = renderTable()
    const rows = [...container.querySelectorAll("tbody tr")]
    const baseline = rows[0] as HTMLElement
    expect(baseline.getAttribute("class") ?? "").toContain("font-semibold")
    // No cell may set a weight of its own: a class on the cell wins over the
    // row's, whatever the order.
    for (const cell of baseline.querySelectorAll("td")) {
      expect(cell.getAttribute("class") ?? "").not.toMatch(
        /\bfont-(medium|normal|semibold|bold)\b/
      )
    }
  })

  it("leaves the reason column empty until something is documented", () => {
    renderTable({
      documentation: {
        runId: "run1" as never,
        groupKey: "Product Manager|5",
        actions: [],
        notes: [],
        locked: false,
      },
    })
    // The heading exists, and nothing fills it on its own: the column is
    // populated by documenting the row, never by the analysis.
    expect(
      screen.getByText(messages.dashboard.payMapping.detail.comparators.reason)
    ).toBeDefined()
  })
})

// Selecting a comparator is what lights its people up in the plot below, so
// it has to be reachable without a mouse. It was a bare onClick on the <tr>
// once, which left the whole feature unavailable to keyboard users.
describe("ComparatorTable selection", () => {
  const NAME =
    messages.dashboard.payMapping.detail.comparators.selectRow.replace(
      "{label}",
      "IT Manager"
    )

  it("exposes each comparator as a named button, without unrowing the row", () => {
    const { container } = renderTable({ onSelect: vi.fn() })
    expect(screen.getByRole("button", { name: NAME })).toBeDefined()
    // A role on the <tr> would replace its row semantics, which breaks the
    // table for the readers the keyboard path exists for.
    for (const row of container.querySelectorAll("tbody tr")) {
      expect(row.getAttribute("role")).toBeNull()
      expect(row.getAttribute("tabindex")).toBeNull()
    }
  })

  it("selects with the keyboard", () => {
    const onSelect = vi.fn()
    renderTable({ onSelect })
    // A real button, so Enter and Space are the browser's job, not ours:
    // what has to hold is that activating it selects.
    fireEvent.click(screen.getByRole("button", { name: NAME }))
    expect(onSelect).toHaveBeenCalledWith("IT Manager|5")
  })

  // A toggle, so its state is aria-pressed, and hitting it again clears the
  // highlight rather than re-selecting the same row.
  it("reports the selected comparator as pressed and toggles off", () => {
    const onSelect = vi.fn()
    renderTable({ onSelect, selectedKey: "IT Manager|5" })
    const button = screen.getByRole("button", { name: NAME })
    expect(button.getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(button)
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  // The row is clickable too, and its handler must not fire alongside the
  // button's and undo the selection.
  it("does not double-fire when the button inside the row is clicked", () => {
    const onSelect = vi.fn()
    renderTable({ onSelect })
    fireEvent.click(screen.getByRole("button", { name: NAME }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  // A read-only rendering must not advertise a control at all.
  it("stays inert when there is nothing to select", () => {
    renderTable()
    expect(screen.queryByRole("button", { name: NAME })).toBeNull()
  })

  // The baseline and the picked row share one wash, so what tells them apart
  // is the row itself: the baseline leads the table and leaves its two
  // difference cells empty, while a picked row sits among the comparators with
  // its differences filled in. That is pinned here because it is now load
  // bearing, not decoration.
  it("marks the baseline and the picked row alike, and lets the row say which is which", () => {
    const { container } = renderTable({
      onSelect: vi.fn(),
      selectedKey: "IT Manager|5",
    })
    const rows = [...container.querySelectorAll("tbody tr")]
    const classesOf = (row: Element) =>
      (row.getAttribute("class") ?? "").split(/\s+/)
    const baseline = rows[0] as Element
    const picked = rows[rows.length - 1] as Element

    for (const row of [baseline, picked]) {
      expect(classesOf(row)).toContain("bg-muted")
      // Neither lightens under the cursor: TableRow hovers to bg-muted/50,
      // which would read as the row losing its mark.
      expect(classesOf(row)).toContain("hover:bg-muted")
    }

    // The two difference columns: empty on the baseline (nothing is a
    // difference from itself), filled on a comparator.
    const differences = (row: Element) =>
      [...row.querySelectorAll("td")]
        .slice(5, 7)
        .map((cell) => cell.textContent ?? "")
    expect(differences(baseline)).toEqual(["", ""])
    // Matched loosely: the money format carries a non-breaking space, and what
    // has to hold is that these cells are filled at all.
    expect(differences(picked)[0]).toContain("7.1%")
    expect(differences(picked)[1]).toContain("4,843")
  })
})

// The collapsed table has to say what was concluded for each row, or the
// reader must expand every one of them to find out. Several reasons plus a
// note do not fit 144px, so the cell states the first reason and counts the
// rest, and the whole answer lives in the card behind it.
const COMPARISON_KEY = "IT Manager|5"

// The reason/answer column only exists inside the documentation layer, so the
// table needs one to render it at all.
const DOCUMENTATION = {
  runId: "run-1" as Parameters<
    typeof ComparatorTable
  >[0]["documentation"] extends { runId: infer R } | undefined
    ? R
    : never,
  groupKey: "Nurse|3",
  actions: [],
  notes: [],
  locked: false,
}

describe("ComparatorTable: the answer column", () => {
  it("counts the reasons it cannot show, and keeps the cell from overflowing", () => {
    renderTable({
      documentation: DOCUMENTATION,
      reasonsByComparison: new Map([
        [COMPARISON_KEY, ["experience", "historicalPay", "competence"]],
      ]),
    })
    const trigger = screen.getByRole("button", { name: /\+2/ })
    expect(trigger.textContent).toContain(
      messages.dashboard.payMapping.reasons.experience
    )
  })

  // A note with no reason is a complete answer in its own right (the gate
  // accepts a written assessment), so the cell has to show it.
  it("shows a note with no reasons yet", () => {
    renderTable({
      documentation: DOCUMENTATION,
      notesByComparison: new Map([[COMPARISON_KEY, "Marknadsläget i Malmö"]]),
    })
    expect(
      screen.getByRole("button", { name: /Marknadsläget i Malmö/ })
    ).toBeDefined()
  })

  it("renders nothing when the comparison has neither", () => {
    const { container } = renderTable({ documentation: DOCUMENTATION })
    expect(
      container.querySelector("[data-slot='hover-card-trigger']")
    ).toBeNull()
  })
})
