import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mockMutation, onQuery } from "@/test/convex-mocks"
import { pickSelectOption } from "@/test/select"

// NumberFlow's custom element does not exist in jsdom; the count chip only
// needs to render its value.
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))

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
let orgRole = "admin"
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org1", name: "Acme", role: orgRole }),
}))
// The AddPersonDialog in the header navigates after a create: give it a
// no-op router (these tests never submit it).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))
// The import and classify buttons are Links: mock next/link with a plain <a>.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string
    children: React.ReactNode
  }) => <a href={href}>{children}</a>,
}))

import type { ClassifyTitleGroup } from "@/components/people/classify/classify-title-table"
import {
  matchesPersonQuery,
  PeopleSection,
} from "@/components/people/people-section"
import { toast } from "@/lib/toast"

const eraseMock = mockMutation("people.erase.erasePersonAsOrg")
const m = messages.dashboard.people

// Fixtures

const PEOPLE = [
  {
    personId: "p1",
    publicId: "pub-p1",
    displayName: "Alice Svensson",
    gender: "Kvinna",
    department: "Engineering",
    ftePercent: 100,
    externalRef: "42",
    birthDate: null,
    employmentStartDate: null,
    country: null,
    isManager: null,
    statisticalCode: null,
    archivedAt: null,
    roleId: "role1",
    senioritySource: "confirmed",
  },
  {
    personId: "p2",
    publicId: "pub-p2",
    displayName: "Bob Larsson",
    gender: "Man",
    department: "Product",
    ftePercent: 80,
    externalRef: null,
    birthDate: null,
    employmentStartDate: null,
    country: null,
    isManager: null,
    statisticalCode: null,
    archivedAt: null,
    roleId: "role1",
    senioritySource: "suggested",
  },
  {
    personId: "p3",
    publicId: "pub-p3",
    displayName: "Charlie Nilsson",
    gender: null,
    department: null,
    ftePercent: null,
    externalRef: null,
    birthDate: null,
    employmentStartDate: null,
    country: null,
    isManager: null,
    statisticalCode: null,
    archivedAt: null,
    roleId: null,
    senioritySource: null,
  },
]

// 30 people so the register paginates (PAGE_SIZE is 25): sorted by name
// ascending, page 1 holds "Person 01".."Person 25" and page 2 the rest.
const MANY_PEOPLE = Array.from({ length: 30 }, (_, i) => ({
  personId: `p${i + 1}`,
  publicId: `pub-${i + 1}`,
  displayName: `Person ${String(i + 1).padStart(2, "0")}`,
  gender: null,
  department: null,
  ftePercent: null,
  externalRef: null,
  birthDate: null,
  employmentStartDate: null,
  country: null,
  isManager: null,
  statisticalCode: null,
  archivedAt: null,
  roleId: null,
  senioritySource: null,
}))

// listRoles options for the role filter (only role1 has people here).
const ROLES = [
  {
    roleId: "role1",
    title: "Software Engineer",
    slug: "software-engineer",
    trackKey: "IC",
    trackName: "IC",
  },
]

// BY_TITLE: p1 confirmed, p2 suggested, p3 unclassified (currentAssignment null)
const BY_TITLE: ClassifyTitleGroup[] = [
  {
    title: "Software Engineer",
    personCount: 2,
    suggestedRoleId: "role1",
    people: [
      {
        personId: "p1",
        displayName: "Alice Svensson",
        externalRef: "42",
        employmentStartDate: null,
        isManager: null,
        suggestedSeniority: "Senior",
        currentAssignment: {
          roleId: "role1",
          seniority: "Senior",
          senioritySource: "confirmed" as const,
        },
      },
      {
        personId: "p2",
        displayName: "Bob Larsson",
        externalRef: null,
        employmentStartDate: null,
        isManager: null,
        suggestedSeniority: "Mid",
        currentAssignment: {
          roleId: "role1",
          seniority: "Mid",
          senioritySource: "suggested" as const,
        },
      },
    ],
  },
  {
    title: null,
    personCount: 1,
    suggestedRoleId: null,
    people: [
      {
        personId: "p3",
        displayName: "Charlie Nilsson",
        externalRef: null,
        employmentStartDate: null,
        isManager: null,
        suggestedSeniority: null,
        currentAssignment: null,
      },
    ],
  },
]

function queryRouter(
  ref: string,
  people = PEOPLE,
  byTitle = BY_TITLE
): unknown {
  if (ref === "people.people.listPeople") return people
  if (ref === "people.classificationQueries.listPeopleByTitle") return byTitle
  if (ref === "assessment.roles.listRoles") return ROLES
  return []
}

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {/* The form wrapper makes Radix Selects render their hidden native
          <select> bubble inputs, which is how the filter tests drive
          onValueChange (same pattern as the classify table tests). */}
      <form>
        <PeopleSection />
      </form>
    </NextIntlClientProvider>
  )
}

describe("PeopleSection", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders a skeleton when any useQuery returns undefined (loading)", () => {
    onQuery(() => undefined)
    renderSection()
    // The empty state text must not appear while loading.
    expect(screen.queryByText(m.empty)).toBeNull()
    // No person data rows visible either.
    expect(screen.queryByText("Alice Svensson")).toBeNull()
    // The header import link is always rendered (stable action slot).
    const links = screen.getAllByRole("link", { name: m.import.title })
    expect(links.length).toBeGreaterThanOrEqual(1)
  })

  it("renders the empty state with an import CTA when people returns []", () => {
    onQuery((ref) => queryRouter(ref, []))
    renderSection()
    expect(screen.getByText(m.empty)).toBeDefined()
    // Both the header link and the empty-state CTA link are present.
    const links = screen.getAllByRole("link", { name: m.import.title })
    expect(links.length).toBeGreaterThanOrEqual(1)
    for (const link of links) {
      expect((link as HTMLAnchorElement).href).toContain("/people/import")
    }
    // The true-empty state renders an icon (not the filtered no-matches state).
    expect(
      document.querySelector('[data-slot="empty-icon"] svg')
    ).not.toBeNull()
  })

  it("renders person rows with gender localized", () => {
    onQuery((ref) => queryRouter(ref))
    renderSection()
    expect(screen.getByText("Alice Svensson")).toBeDefined()
    // Gender should be the localized label (English: "Woman"), not the raw
    // enum value. Cell-scoped queries: the filter selects' hidden native
    // options repeat texts like "Engineering".
    expect(screen.getByRole("cell", { name: "Woman" })).toBeDefined()
    expect(screen.queryByText("Kvinna")).toBeNull()
    expect(screen.getByRole("cell", { name: "Engineering" })).toBeDefined()
    expect(screen.getByRole("cell", { name: "100%" })).toBeDefined()
  })

  it("links the person name cell to the detail route", () => {
    onQuery((ref) => queryRouter(ref))
    renderSection()
    // Alice Svensson links by her short publicId, never the internal id.
    const link = screen.getByRole("link", { name: "Alice Svensson" })
    expect((link as HTMLAnchorElement).href).toContain("/people/pub-p1")
  })

  it("keeps the Import link in the header action area", () => {
    onQuery((ref) => queryRouter(ref))
    renderSection()
    const importLinks = screen.getAllByRole("link", { name: m.import.title })
    expect(importLinks.length).toBeGreaterThanOrEqual(1)
  })

  // ---------------------------------------------------------------------------
  // Search, filters, pagination
  // ---------------------------------------------------------------------------

  it("search narrows rows by name or department and shows the result count", () => {
    onQuery((ref) => queryRouter(ref))
    renderSection()
    const search = screen.getByLabelText(m.toolbar.searchPlaceholder)
    fireEvent.change(search, { target: { value: "alice" } })
    expect(screen.getByText("Alice Svensson")).toBeDefined()
    expect(screen.queryByText("Bob Larsson")).toBeNull()
    expect(screen.getByText("1 of 3 people")).toBeDefined()

    // Department text matches too.
    fireEvent.change(search, { target: { value: "product" } })
    expect(screen.getByText("Bob Larsson")).toBeDefined()
    expect(screen.queryByText("Alice Svensson")).toBeNull()
  })

  it("filters by department", async () => {
    onQuery((ref) => queryRouter(ref))
    renderSection()
    await pickSelectOption(
      screen.getByRole("combobox", {
        name: messages.dashboard.people.columns.department,
      }),
      "Product"
    )
    expect(screen.getByText("Bob Larsson")).toBeDefined()
    expect(screen.queryByText("Alice Svensson")).toBeNull()
  })

  it("filters by gender", async () => {
    onQuery((ref) => queryRouter(ref))
    renderSection()
    await pickSelectOption(
      screen.getByRole("combobox", {
        name: messages.dashboard.people.columns.gender,
      }),
      messages.dashboard.people.gender.Man
    )
    expect(screen.getByText("Bob Larsson")).toBeDefined()
    expect(screen.queryByText("Alice Svensson")).toBeNull()
    expect(screen.queryByText("Charlie Nilsson")).toBeNull()
  })

  it("filters by role and flags a still-suggested assignment only while filtering", async () => {
    onQuery((ref) => queryRouter(ref))
    renderSection()
    // No role filter yet: the register stays clean, no suggested badge.
    expect(screen.queryByText(m.suggestedBadge)).toBeNull()
    await pickSelectOption(
      screen.getByRole("combobox", {
        name: messages.dashboard.people.columns.role,
      }),
      "Software Engineer"
    )
    // Only people assigned to role1 remain; the unclassified person is dropped.
    expect(screen.getByText("Alice Svensson")).toBeDefined()
    expect(screen.getByText("Bob Larsson")).toBeDefined()
    expect(screen.queryByText("Charlie Nilsson")).toBeNull()
    // The suggested badge shows on the unconfirmed assignment (Bob) only.
    expect(screen.getAllByText(m.suggestedBadge)).toHaveLength(1)
  })

  it("filters by FTE: full-time is exactly 100, part-time below, unknown only under all", async () => {
    onQuery((ref) => queryRouter(ref))
    renderSection()
    const trigger = () =>
      screen.getByRole("combobox", {
        name: messages.dashboard.people.columns.fte,
      })
    // Full-time: Alice (100) only; Charlie (unknown FTE) is excluded.
    await pickSelectOption(trigger(), m.toolbar.fteFull)
    expect(screen.getByText("Alice Svensson")).toBeDefined()
    expect(screen.queryByText("Bob Larsson")).toBeNull()
    expect(screen.queryByText("Charlie Nilsson")).toBeNull()
    // Part-time: Bob (80) only.
    await pickSelectOption(trigger(), m.toolbar.ftePart)
    expect(screen.getByText("Bob Larsson")).toBeDefined()
    expect(screen.queryByText("Alice Svensson")).toBeNull()
    expect(screen.queryByText("Charlie Nilsson")).toBeNull()
    // Back to all: everyone, including the unknown-FTE person.
    await pickSelectOption(trigger(), m.toolbar.fteAll)
    expect(screen.getByText("Charlie Nilsson")).toBeDefined()
  })

  it("shows the no-matches empty state and clears filters from it", () => {
    onQuery((ref) => queryRouter(ref))
    renderSection()
    fireEvent.change(screen.getByLabelText(m.toolbar.searchPlaceholder), {
      target: { value: "zzz" },
    })
    expect(screen.getByText(m.toolbar.noMatches)).toBeDefined()
    fireEvent.click(
      screen.getByRole("button", { name: m.toolbar.clearFilters })
    )
    expect(screen.getByText("Alice Svensson")).toBeDefined()
    expect(screen.getByText("Bob Larsson")).toBeDefined()
  })

  it("paginates past 25 people and navigates with Next", () => {
    // 30 unclassified people: page 1 shows 25 rows, page 2 the last 5.
    const manyPeople = Array.from({ length: 30 }, (_, i) => ({
      personId: `p${i + 1}`,
      publicId: `pub-${i + 1}`,
      displayName: `Person ${String(i + 1).padStart(2, "0")}`,
      gender: null,
      department: null,
      ftePercent: null,
      externalRef: null,
      birthDate: null,
      employmentStartDate: null,
      country: null,
      isManager: null,
      statisticalCode: null,
      archivedAt: null,
      roleId: null,
      senioritySource: null,
    }))
    onQuery((ref) => queryRouter(ref, manyPeople, []))
    renderSection()

    // 1 header row + 25 data rows on the first page.
    expect(screen.getAllByRole("row")).toHaveLength(26)
    expect(screen.getByText("Person 01")).toBeDefined()
    expect(screen.queryByText("Person 26")).toBeNull()

    fireEvent.click(screen.getByLabelText(m.toolbar.next))
    expect(screen.getAllByRole("row")).toHaveLength(6)
    expect(screen.getByText("Person 26")).toBeDefined()
    expect(screen.queryByText("Person 01")).toBeNull()

    fireEvent.click(screen.getByLabelText(m.toolbar.previous))
    expect(screen.getByText("Person 01")).toBeDefined()
  })

  it("hides the pagination control when everything fits on one page", () => {
    onQuery((ref) => queryRouter(ref))
    renderSection()
    expect(screen.queryByLabelText(m.toolbar.next)).toBeNull()
  })

  it("sorts by name ascending by default", () => {
    // Fixture order is deliberately shuffled; the default sort restores it.
    onQuery((ref) =>
      queryRouter(ref, [PEOPLE[2], PEOPLE[0], PEOPLE[1]] as typeof PEOPLE)
    )
    renderSection()
    expect(screen.getAllByRole("row")[1]?.textContent).toContain(
      "Alice Svensson"
    )
  })

  it("clicking the default-sorted name heading flips it to descending and back", () => {
    onQuery((ref) => queryRouter(ref))
    renderSection()
    const nameHeader = screen.getByRole("button", { name: m.columns.name })
    const firstDataRow = () => screen.getAllByRole("row")[1]

    // Already ascending by default, so the first click flips to descending.
    fireEvent.click(nameHeader)
    expect(firstDataRow()?.textContent).toContain("Charlie Nilsson")

    fireEvent.click(nameHeader)
    expect(firstDataRow()?.textContent).toContain("Alice Svensson")
  })

  it("sorts FTE numerically with missing values below real ones", () => {
    onQuery((ref) => queryRouter(ref))
    renderSection()
    const fteHeader = screen.getByRole("button", { name: m.columns.fte })
    const firstDataRow = () => screen.getAllByRole("row")[1]

    // Ascending: Charlie (no FTE) sorts below every real percentage.
    fireEvent.click(fteHeader)
    expect(firstDataRow()?.textContent).toContain("Charlie Nilsson")

    // Descending: Alice's 100% first.
    fireEvent.click(fteHeader)
    expect(firstDataRow()?.textContent).toContain("Alice Svensson")
  })

  it("sorts across all pages: a descending sort surfaces page-2 rows on page 1", () => {
    onQuery((ref) => queryRouter(ref, MANY_PEOPLE, []))
    renderSection()

    // Unsorted, Person 30 lives on page 2.
    expect(screen.queryByText("Person 30")).toBeNull()

    // Sort descending (one click: name is already ascending by default): the
    // whole set reorders, so page 1 now starts at Person 30 and Person 01
    // moves to page 2.
    const nameHeader = screen.getByRole("button", { name: m.columns.name })
    fireEvent.click(nameHeader)
    expect(screen.getAllByRole("row")[1]?.textContent).toContain("Person 30")
    expect(screen.queryByText("Person 01")).toBeNull()

    // Page 2 continues the sorted order.
    fireEvent.click(screen.getByLabelText(m.toolbar.next))
    expect(screen.getAllByRole("row")[1]?.textContent).toContain("Person 05")
    expect(screen.getByText("Person 01")).toBeDefined()
  })

  it("search resets to the first page", () => {
    onQuery((ref) => queryRouter(ref, MANY_PEOPLE, []))
    renderSection()
    fireEvent.click(screen.getByLabelText(m.toolbar.next))
    expect(screen.getByText("Person 26")).toBeDefined()
    // Searching from page 2 must land on page 1 of the filtered set.
    fireEvent.change(screen.getByLabelText(m.toolbar.searchPlaceholder), {
      target: { value: "person 0" },
    })
    expect(screen.getByText("Person 01")).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Row selection and bulk delete
  // ---------------------------------------------------------------------------

  describe("selection", () => {
    beforeEach(() => {
      orgRole = "admin"
      eraseMock.mockReset()
      eraseMock.mockResolvedValue(null)
      vi.mocked(toast.success).mockReset()
      vi.mocked(toast.error).mockReset()
    })

    // Selecting one named row, by the aria-label the register builds per row.
    function selectRow(name: string) {
      fireEvent.click(
        screen.getByRole("checkbox", {
          name: m.bulk.selectRow.replace("{name}", name),
        })
      )
    }

    // The CTA's label carries the count, so it is matched by shape rather than
    // by a fixed string.
    const CTA = /^Delete \d+ employees?$/

    it("hides the delete button entirely until something is selected", () => {
      onQuery((ref) => queryRouter(ref))
      renderSection()
      expect(screen.queryByRole("button", { name: CTA })).toBeNull()
      expect(screen.queryByText(/employees? selected/)).toBeNull()
    })

    // Erasing people is irreversible and admin-only, so an editor never gets
    // the bulk control. Selection itself stays: it is what the register's own
    // rows offer, and nothing else about the page is admin's.
    it("offers no bulk delete to an editor, however many rows are selected", () => {
      orgRole = "editor"
      onQuery((ref) => queryRouter(ref))
      renderSection()
      selectRow("Alice Svensson")
      selectRow("Bob Larsson")
      expect(screen.queryByRole("button", { name: CTA })).toBeNull()
    })

    it("selects a single row and puts the count in the button label", () => {
      onQuery((ref) => queryRouter(ref))
      renderSection()
      selectRow("Alice Svensson")
      expect(
        screen.getByRole("button", { name: "Delete 1 employee" })
      ).toBeDefined()
      // The visible count lives only in the button; the announcement for
      // screen readers is the visually-hidden live region.
      const live = screen.getByText("1 employee selected")
      expect(live.className).toContain("sr-only")
      expect(live.getAttribute("aria-live")).toBe("polite")
    })

    it("pluralizes the button label as the selection grows", () => {
      onQuery((ref) => queryRouter(ref))
      renderSection()
      selectRow("Alice Svensson")
      selectRow("Bob Larsson")
      expect(
        screen.getByRole("button", { name: "Delete 2 employees" })
      ).toBeDefined()
      expect(
        screen.queryByRole("button", { name: "Delete 1 employee" })
      ).toBeNull()
    })

    it("puts the delete button in the filter row at the same height as the other controls", () => {
      onQuery((ref) => queryRouter(ref))
      renderSection()
      selectRow("Alice Svensson")
      const search = screen.getByLabelText(m.toolbar.searchPlaceholder)
      const button = screen.getByRole("button", { name: "Delete 1 employee" })
      // The button shares the toolbar with the search field rather than
      // sitting in a row of its own.
      const toolbar = search.closest("div.flex.flex-wrap")
      expect(toolbar).not.toBeNull()
      expect(toolbar?.contains(button)).toBe(true)
      // It takes the default Button size, so it is exactly as tall as the
      // search field beside it (both ride nova's h-8 control scale; neither
      // pins its own height).
      expect(search.className).toContain("h-8")
      expect(button.className).toContain("h-8")
    })

    it("puts the delete button last, hard against the right edge", () => {
      onQuery((ref) => queryRouter(ref))
      renderSection()
      // Narrow the table so the result count renders beside the button.
      fireEvent.change(screen.getByLabelText(m.toolbar.searchPlaceholder), {
        target: { value: "Alice" },
      })
      selectRow("Alice Svensson")
      const button = screen.getByRole("button", { name: "Delete 1 employee" })
      const count = screen.getByText(
        m.toolbar.resultCount.replace("{shown}", "1").replace("{total}", "3")
      )
      // Both live in the row's right-aligned group, the button after the count.
      const rightGroup = button.parentElement
      expect(rightGroup?.className).toContain("ml-auto")
      expect(rightGroup?.contains(count)).toBe(true)
      expect(
        count.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
    })

    it("puts the header checkbox in the mixed state on a partial page", () => {
      onQuery((ref) => queryRouter(ref))
      renderSection()
      selectRow("Alice Svensson")
      const headerBox = screen.getByRole("checkbox", { name: m.bulk.selectAll })
      expect(headerBox.getAttribute("aria-checked")).toBe("mixed")
      // Selecting the rest of the page flips it to fully checked.
      selectRow("Bob Larsson")
      selectRow("Charlie Nilsson")
      expect(headerBox.getAttribute("aria-checked")).toBe("true")
    })

    it("select-all covers only the current page, not the whole filtered set", () => {
      onQuery((ref) => queryRouter(ref, MANY_PEOPLE, []))
      renderSection()
      fireEvent.click(screen.getByRole("checkbox", { name: m.bulk.selectAll }))
      // 30 people, page size 25: select-all takes the page, never all 30.
      expect(screen.getByText("25 employees selected")).toBeDefined()
    })

    it("keeps the selection when paging, and select-all on page 2 adds to it", () => {
      onQuery((ref) => queryRouter(ref, MANY_PEOPLE, []))
      renderSection()
      fireEvent.click(screen.getByRole("checkbox", { name: m.bulk.selectAll }))
      fireEvent.click(screen.getByLabelText(m.toolbar.next))
      // The 25 from page 1 are still selected while page 2 is shown.
      expect(screen.getByText("25 employees selected")).toBeDefined()
      fireEvent.click(screen.getByRole("checkbox", { name: m.bulk.selectAll }))
      expect(screen.getByText("30 employees selected")).toBeDefined()
    })

    it("prunes the selection to what the filter still shows", () => {
      onQuery((ref) => queryRouter(ref))
      renderSection()
      fireEvent.click(screen.getByRole("checkbox", { name: m.bulk.selectAll }))
      expect(screen.getByText("3 employees selected")).toBeDefined()
      // Narrowing to Alice drops the other two from the effective selection.
      fireEvent.change(screen.getByLabelText(m.toolbar.searchPlaceholder), {
        target: { value: "Alice" },
      })
      expect(screen.getByText("1 employee selected")).toBeDefined()
    })

    it("deletes exactly the selected people, one call each, then clears the selection", async () => {
      onQuery((ref) => queryRouter(ref))
      renderSection()
      selectRow("Alice Svensson")
      selectRow("Bob Larsson")
      fireEvent.click(screen.getByRole("button", { name: CTA }))
      fireEvent.change(screen.getByLabelText(m.bulk.confirmLabel), {
        target: { value: "DELETE" },
      })
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: m.bulk.confirm })
        ).toHaveProperty("disabled", false)
      )
      fireEvent.click(screen.getByRole("button", { name: m.bulk.confirm }))

      await waitFor(() => expect(toast.success).toHaveBeenCalled())
      expect(eraseMock).toHaveBeenCalledTimes(2)
      expect(eraseMock.mock.calls.map((c) => c[0])).toEqual([
        { orgId: "org1", personId: "p1" },
        { orgId: "org1", personId: "p2" },
      ])
      // The dialog closed and the selection reset. The fixture query still
      // returns all three people, so a stale selection would still count here.
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
      expect(screen.queryByRole("button", { name: CTA })).toBeNull()
    })

    it("renders the checkbox column in the loading skeleton", () => {
      onQuery(() => undefined)
      renderSection()
      // The header checkbox is real chrome with a static label, so it renders
      // live during loading rather than as a gray bar.
      expect(
        screen.getByRole("checkbox", { name: m.bulk.selectAll })
      ).toBeDefined()
      // Skeleton rows carry a real, non-interactive checkbox in the same slot.
      // They are aria-hidden (decorative chrome standing in for nothing), so
      // they are absent from the role tree by design: query the DOM directly.
      expect(
        document.querySelectorAll('[data-slot="checkbox"][aria-hidden="true"]')
          .length
      ).toBeGreaterThan(0)
    })
  })
})

describe("matchesPersonQuery", () => {
  it("matches case-insensitive substrings of name and department", () => {
    const person = { name: "Alice Svensson", department: "Engineering" }
    expect(matchesPersonQuery(person, "ali")).toBe(true)
    expect(matchesPersonQuery(person, "SVENS")).toBe(true)
    expect(matchesPersonQuery(person, "engineer")).toBe(true)
    expect(matchesPersonQuery(person, "bob")).toBe(false)
  })

  it("matches everything on an empty or whitespace query", () => {
    const person = { name: "Alice Svensson", department: null }
    expect(matchesPersonQuery(person, "")).toBe(true)
    expect(matchesPersonQuery(person, "   ")).toBe(true)
  })

  it("never matches the department when it is null", () => {
    expect(
      matchesPersonQuery({ name: "Alice", department: null }, "engineering")
    ).toBe(false)
  })
})
