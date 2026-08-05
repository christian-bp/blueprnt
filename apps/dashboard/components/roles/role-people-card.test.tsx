import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { onQuery } from "@/test/convex-mocks"

const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
// NumberFlow renders a custom element that happy-dom never upgrades, so its
// getSnapshotBeforeUpdate throws the moment the count CHANGES in place, which
// is exactly what the pagination case exercises. The digit animation is the
// library's business; these tests are about the count's value.
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))

import { RolePeopleCard } from "@/components/roles/role-people-card"

const t = messages.dashboard.roles.detail.people
const columns = messages.dashboard.people.columns

function holder(overrides: Record<string, unknown>) {
  return {
    personId: "p1",
    publicId: "abc123",
    displayName: "Anna Lind",
    seniority: "IC3",
    senioritySource: "confirmed",
    department: "Engineering",
    ftePercent: 100,
    ...overrides,
  }
}

// roleId is an opaque id at the JS layer; the mocked query ignores it.
function card(archived = false) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <RolePeopleCard
        orgId="org-1"
        roleId={"role-1" as never}
        archived={archived}
      />
    </NextIntlClientProvider>
  )
}

function renderCard(archived = false) {
  return render(card(archived))
}

describe("RolePeopleCard", () => {
  beforeEach(() => useQueryMock.mockReset())
  afterEach(() => cleanup())

  it("lists the holders with their seniority, department and FTE", () => {
    useQueryMock.mockReturnValue([
      holder({}),
      holder({
        personId: "p2",
        publicId: "def456",
        displayName: "Bo Persson",
        seniority: "IC2",
        department: "Platform",
        ftePercent: 80,
      }),
    ])
    renderCard()
    expect(screen.getByText(t.heading)).toBeDefined()
    // The count sits next to the heading (NumberFlow renders the digits into
    // an accessible-text node alongside its animated glyphs).
    expect(screen.getByText("2")).toBeDefined()
    // The query is org-scoped and locale-aware; a dropped locale would
    // silently change the name order.
    expect(useQueryMock).toHaveBeenCalledWith(
      "people.assignments.listPeopleForRole",
      {
        orgId: "org-1",
        roleId: "role-1",
        locale: "en",
      }
    )
    // The name links to the person page by publicId, never the internal id.
    expect(
      screen.getByRole("link", { name: "Anna Lind" }).getAttribute("href")
    ).toBe("/people/abc123")
    expect(screen.getByText("IC3")).toBeDefined()
    expect(screen.getByText("Engineering")).toBeDefined()
    expect(screen.getByText("100%")).toBeDefined()
    expect(screen.getByText("80%")).toBeDefined()
    // Column labels come from the people surface (one set of labels).
    expect(screen.getByText(columns.seniority)).toBeDefined()
  })

  it("flags an assignment that is only suggested", () => {
    useQueryMock.mockReturnValue([
      holder({}),
      holder({
        personId: "p2",
        publicId: "def456",
        displayName: "Bo Persson",
        senioritySource: "suggested",
      }),
    ])
    renderCard()
    const badges = screen.getAllByText(messages.dashboard.people.suggestedBadge)
    expect(badges).toHaveLength(1)
    expect(badges[0]?.closest("tr")?.textContent).toContain("Bo Persson")
  })

  it("renders empty values for a person with no department or FTE", () => {
    useQueryMock.mockReturnValue([
      holder({ department: null, ftePercent: null }),
    ])
    renderCard()
    const row = screen.getByRole("link", { name: "Anna Lind" }).closest("tr")
    if (row === null) throw new Error("row not found")
    // No placeholder text and no crash: the cells are simply blank.
    expect(row.textContent).toBe("Anna LindIC3")
  })

  it("points at Classify when the role has no employees yet", () => {
    useQueryMock.mockReturnValue([])
    renderCard()
    expect(screen.getByText(t.empty)).toBeDefined()
    expect(
      screen
        .getByRole("link", {
          name: messages.dashboard.people.import.done.goToClassify,
        })
        .getAttribute("href")
    ).toBe("/people/classify")
    // No count badge for an empty role.
    expect(screen.queryByText("0")).toBeNull()
  })

  it("explains an archived role instead of offering Classify", () => {
    // Archiving a role ends every open assignment, so this is the only state
    // an archived role can be in.
    useQueryMock.mockReturnValue([])
    renderCard(true)
    expect(screen.getByText(t.archivedEmpty)).toBeDefined()
    expect(screen.queryByText(t.empty)).toBeNull()
    // The Classify page hides archived roles, so the CTA would be a dead end.
    expect(
      screen.queryByRole("link", {
        name: messages.dashboard.people.import.done.goToClassify,
      })
    ).toBeNull()
  })

  it("paginates past a full page and clamps a page that disappears", () => {
    const many = Array.from({ length: 26 }, (_, index) =>
      holder({
        personId: `p${index}`,
        publicId: `pub${index}`,
        // Zero-padded so the fixture order matches the query's name order.
        displayName: `Person ${String(index).padStart(2, "0")}`,
      })
    )
    useQueryMock.mockReturnValue(many)
    const { rerender } = renderCard()
    expect(screen.getByText("Person 00")).toBeDefined()
    expect(screen.queryByText("Person 25")).toBeNull()

    fireEvent.click(
      screen.getByLabelText(messages.dashboard.people.toolbar.next)
    )
    expect(screen.getByText("Person 25")).toBeDefined()
    expect(screen.queryByText("Person 00")).toBeNull()

    // The list shrinks below one page while the pager sits on page 2.
    useQueryMock.mockReturnValue(many.slice(0, 3))
    rerender(card())
    expect(screen.getByText("Person 00")).toBeDefined()
    expect(
      screen.queryByLabelText(messages.dashboard.people.toolbar.next)
    ).toBeNull()
  })

  it("shows a content-shaped skeleton while the query is loading", () => {
    useQueryMock.mockReturnValue(undefined)
    renderCard()
    // The header is real chrome; only the rows are bars.
    expect(screen.getByText(t.heading)).toBeDefined()
    expect(screen.getByText(columns.name)).toBeDefined()
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBe(16)
  })
})
