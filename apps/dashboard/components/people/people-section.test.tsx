import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import { onQuery } from "@/test/convex-mocks"
import { pickSelectOption } from "@/test/select"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org1", name: "Acme", role: "admin" }),
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
        suggestedLevel: "Senior",
        currentAssignment: {
          roleId: "role1",
          level: "Senior",
          levelSource: "confirmed" as const,
        },
      },
      {
        personId: "p2",
        displayName: "Bob Larsson",
        externalRef: null,
        employmentStartDate: null,
        isManager: null,
        suggestedLevel: "Mid",
        currentAssignment: {
          roleId: "role1",
          level: "Mid",
          levelSource: "suggested" as const,
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
        suggestedLevel: null,
        currentAssignment: null,
      },
    ],
  },
]

const SETTINGS = { pseudonymizeNames: false }

function queryRouter(
  ref: string,
  people = PEOPLE,
  byTitle = BY_TITLE,
  settings: { pseudonymizeNames: boolean } | undefined = SETTINGS
): unknown {
  if (ref === "people.people.listPeople") return people
  if (ref === "people.classificationQueries.listPeopleByTitle") return byTitle
  if (ref === "accounts.organization.getOrganizationSettings") return settings
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
    onQuery((ref) => queryRouter(ref, [], [], SETTINGS))
    renderSection()
    expect(screen.getByText(m.empty)).toBeDefined()
    // Both the header link and the empty-state CTA link are present.
    const links = screen.getAllByRole("link", { name: m.import.title })
    expect(links.length).toBeGreaterThanOrEqual(1)
    for (const link of links) {
      expect((link as HTMLAnchorElement).href).toContain("/people/import")
    }
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

  it("renders real name when pseudonymizeNames is false", () => {
    onQuery((ref) =>
      queryRouter(ref, PEOPLE, BY_TITLE, { pseudonymizeNames: false })
    )
    renderSection()
    expect(screen.getByText("Alice Svensson")).toBeDefined()
    expect(screen.queryByText("Employee #42")).toBeNull()
  })

  it("renders pseudonym when pseudonymizeNames is true and externalRef is set", () => {
    onQuery((ref) =>
      queryRouter(ref, PEOPLE, BY_TITLE, { pseudonymizeNames: true })
    )
    renderSection()
    // Alice has externalRef "42" -> should show pseudonym
    expect(screen.queryByText("Alice Svensson")).toBeNull()
    expect(screen.getByText("Employee #42")).toBeDefined()
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
    }))
    onQuery((ref) => queryRouter(ref, manyPeople, []))
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
    }))
    onQuery((ref) => queryRouter(ref, manyPeople, []))
    renderSection()
    fireEvent.click(screen.getByLabelText(m.toolbar.next))
    expect(screen.getByText("Person 26")).toBeDefined()
    // Searching from page 2 must land on page 1 of the filtered set.
    fireEvent.change(screen.getByLabelText(m.toolbar.searchPlaceholder), {
      target: { value: "person 0" },
    })
    expect(screen.getByText("Person 01")).toBeDefined()
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
