import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { pickSelectOption } from "@/test/select"
import { ROLE_SKELETON_COLUMNS } from "@/components/roles/role-table-row"
import { RolesTable, type RolesTableRow } from "@/components/roles/roles-table"

const pushMock = vi.fn()
// NumberFlow's custom element does not exist in jsdom; the count chip only
// needs to render its value.
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

const toolbar = messages.dashboard.roles.toolbar

function row(overrides: Partial<RolesTableRow>): RolesTableRow {
  return {
    roleId: "r1",
    slug: "r1",
    title: "Senior Engineer",
    function: "Engineering",
    team: "Core",
    trackKey: "IC",
    trackName: "Individual contributor",
    ratedCount: 3,
    totalCriteria: 9,
    familyId: "f-eng",
    familyName: "Engineering",
    familySlug: "engineering",
    employeeCount: 0,
    level: null,
    profileComplete: true,
    ...overrides,
  }
}

const ROLES: RolesTableRow[] = [
  row({ roleId: "r1", title: "Senior Engineer" }),
  row({ roleId: "r2", title: "Staff Engineer" }),
  row({
    roleId: "r3",
    title: "Account Executive",
    team: "Sales North",
    function: "Sales",
    trackKey: "M",
    trackName: "Manager",
    familyId: "f-sales",
    familyName: "Sales",
    familySlug: "sales",
  }),
  row({
    roleId: "r4",
    title: "Office Coordinator",
    team: "Ops",
    function: "Operations",
    familyId: null,
    familyName: null,
    familySlug: null,
  }),
]

const TRACKS = [
  { key: "IC", name: "Individual contributor" },
  { key: "M", name: "Manager" },
]

function renderTable(roles: RolesTableRow[] = ROLES) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RolesTable roles={roles} tracks={TRACKS} />
    </NextIntlClientProvider>
  )
}

describe("RolesTable", () => {
  afterEach(() => {
    cleanup()
    pushMock.mockReset()
  })

  it("renders one table with family group rows, counts, and links", () => {
    renderTable()
    // One single column header row set.
    expect(screen.getAllByRole("columnheader")).toHaveLength(5)
    // Family groups in name order, family-less last.
    const engineering = screen.getByRole("link", { name: "Engineering" })
    expect(engineering.getAttribute("href")).toBe("/roles/families/engineering")
    expect(screen.getByRole("link", { name: "Sales" })).toBeDefined()
    expect(screen.getByText(messages.dashboard.roles.family.none)).toBeDefined()
    // Counts per group. next-intl renders the ICU plural: 2 -> "2 roles".
    expect(screen.getByText("2 roles")).toBeDefined()
  })

  // The same guard the family page carries, for the same reason, but here the
  // drift is easier to cause: the headings are hand-written while the body
  // cells come from the TanStack column defs, so the two counts have
  // independent sources. Adding a column def without a heading (or the
  // reverse) slides every later value one column left under table-fixed,
  // exactly as it did on the family page, and nothing throws. The skeleton is
  // a third independent source and is checked against the same number, so a
  // heading added without a skeleton entry cannot make the table gain a
  // column when the data arrives.
  it("gives every row a cell for every heading", () => {
    const view = renderTable()
    const headings = view.container.querySelectorAll("thead th")
    expect(headings.length).toBeGreaterThan(0)
    expect(ROLE_SKELETON_COLUMNS).toHaveLength(headings.length)
    const rows = view.container.querySelectorAll("tbody tr")
    expect(rows.length).toBeGreaterThan(0)
    let groupRows = 0
    let dataRows = 0
    for (const row of rows) {
      const cells = row.querySelectorAll("td")
      // A family group row is one spanning cell; a role row is one cell per
      // heading. Both have to add up to the same width.
      if (cells.length === 1 && cells[0]?.hasAttribute("colspan") === true) {
        groupRows++
        expect(Number(cells[0]?.getAttribute("colspan"))).toBe(headings.length)
      } else {
        dataRows++
        expect(cells).toHaveLength(headings.length)
      }
    }
    // Neither branch may be vacuous: the fixture has both kinds of row.
    expect(groupRows).toBeGreaterThan(0)
    expect(dataRows).toBeGreaterThan(0)
  })

  it("searching hides families without matches and shows the counter", () => {
    renderTable()
    fireEvent.change(screen.getByPlaceholderText(toolbar.searchPlaceholder), {
      target: { value: "sales" },
    })
    // Only the Sales family remains (its group row + Account Executive).
    expect(screen.queryByRole("link", { name: "Engineering" })).toBeNull()
    expect(screen.getByText("Account Executive")).toBeDefined()
    // Counter: 1 of 4 roles.
    expect(
      screen.getByText(
        toolbar.resultCount.replace("{shown}", "1").replace("{total}", "4")
      )
    ).toBeDefined()
  })

  it("filters by track via the select", async () => {
    renderTable()
    await pickSelectOption(
      screen.getByRole("combobox", {
        name: messages.dashboard.roles.table.track,
      }),
      "Manager"
    )
    expect(screen.getByText("Account Executive")).toBeDefined()
    expect(screen.queryByText("Senior Engineer")).toBeNull()
  })

  it("shows the zero-match empty state and clears all filters", () => {
    renderTable()
    fireEvent.change(screen.getByPlaceholderText(toolbar.searchPlaceholder), {
      target: { value: "no such role" },
    })
    expect(screen.getByText(toolbar.noMatches)).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: toolbar.clearFilters }))
    expect(screen.getByText("Senior Engineer")).toBeDefined()
    // Counter hidden again without active filters.
    expect(
      screen.queryByText(
        toolbar.resultCount.replace("{shown}", "4").replace("{total}", "4")
      )
    ).toBeNull()
  })

  it("does not double-navigate when the title link itself is clicked", () => {
    renderTable()
    fireEvent.click(screen.getByRole("link", { name: "Senior Engineer" }))
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("navigates on row click while the title stays a real link", () => {
    renderTable()
    const titleLink = screen.getByRole("link", { name: "Senior Engineer" })
    expect(titleLink.getAttribute("href")).toBe("/roles/r1")
    const rowEl = titleLink.closest("tr")
    if (rowEl === null) throw new Error("row not found")
    fireEvent.click(within(rowEl).getByText("Core"))
    expect(pushMock).toHaveBeenCalledWith("/roles/r1")
  })

  it("shows the level, the rate link for a waiting role, and the absence line only where rating cannot start", () => {
    renderTable([
      row({ roleId: "r1", title: "Done Role", level: 3 }),
      row({ roleId: "r2", slug: "todo-role", title: "Todo Role", level: null }),
      row({
        roleId: "r3",
        title: "Bare Role",
        level: null,
        profileComplete: false,
      }),
    ])
    expect(screen.getByText("3")).toBeDefined()
    // A ready-but-unrated role carries the act itself: the register is the
    // one-press way into the rate flow.
    const rateLink = screen.getByRole("link", {
      name: messages.dashboard.rating.title,
    })
    expect(rateLink.getAttribute("href")).toBe("/roles/todo-role/rate")
    expect(rateLink.closest("tr")?.textContent).toContain("Todo Role")
    // A role that cannot be rated yet is called out, never a blank cell and
    // never a dead link.
    const marker = screen.getByText(messages.dashboard.roles.notEvaluated)
    expect(marker.closest("tr")?.textContent).toContain("Bare Role")
  })
})
