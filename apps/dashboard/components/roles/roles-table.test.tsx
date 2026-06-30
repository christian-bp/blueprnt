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
import { RolesTable, type RolesTableRow } from "@/components/roles/roles-table"
import { matchesRoleQuery } from "@/components/roles/roles-table"

const ROLE = { title: "Senior Engineer", team: "Core", function: "Engineering" }

describe("matchesRoleQuery", () => {
  it("matches case-insensitive substrings in title, team, and function", () => {
    expect(matchesRoleQuery(ROLE, "senior")).toBe(true)
    expect(matchesRoleQuery(ROLE, "core")).toBe(true)
    expect(matchesRoleQuery(ROLE, "ENGINEERING")).toBe(true)
  })

  it("returns true for an empty or whitespace query", () => {
    expect(matchesRoleQuery(ROLE, "")).toBe(true)
    expect(matchesRoleQuery(ROLE, "   ")).toBe(true)
  })

  it("returns false when no field matches", () => {
    expect(matchesRoleQuery(ROLE, "sales")).toBe(false)
  })
})

const pushMock = vi.fn()
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
    band: null,
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
      {/* form wrapper: radix Selects render their hidden native <select>
          only inside a form under happy-dom (same pattern as family-picker). */}
      <form>
        <RolesTable roles={roles} tracks={TRACKS} />
      </form>
    </NextIntlClientProvider>
  )
}

// The toolbar's only select: the track filter.
function hiddenSelects(): HTMLSelectElement[] {
  return [...document.querySelectorAll("select")]
}

describe("RolesTable", () => {
  afterEach(() => {
    cleanup()
    pushMock.mockReset()
  })

  it("renders one table with family group rows, counts, and links", () => {
    renderTable()
    // One single column header row set.
    expect(screen.getAllByRole("columnheader")).toHaveLength(4)
    // Family groups in name order, family-less last.
    const engineering = screen.getByRole("link", { name: "Engineering" })
    expect(engineering.getAttribute("href")).toBe("/roles/families/engineering")
    expect(screen.getByRole("link", { name: "Sales" })).toBeDefined()
    expect(screen.getByText(messages.dashboard.roles.family.none)).toBeDefined()
    // Counts per group. next-intl renders the ICU plural: 2 -> "2 roles".
    expect(screen.getByText("2 roles")).toBeDefined()
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

  it("filters by track via the select", () => {
    renderTable()
    const trackSelect = hiddenSelects()[0]
    if (trackSelect === undefined) throw new Error("track select missing")
    fireEvent.change(trackSelect, { target: { value: "M" } })
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

  it("shows the band for an evaluated role and not-evaluated otherwise", () => {
    renderTable([
      row({ roleId: "r1", title: "Done Role", band: 3 }),
      row({ roleId: "r2", title: "Todo Role", band: null }),
    ])
    expect(screen.getByText("3")).toBeDefined()
    expect(
      screen.getByText(messages.dashboard.roles.notEvaluated)
    ).toBeDefined()
  })
})
