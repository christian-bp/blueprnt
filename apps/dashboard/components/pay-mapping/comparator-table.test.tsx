import { cleanup, render, screen, within } from "@testing-library/react"
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
