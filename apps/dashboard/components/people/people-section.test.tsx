import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import { onQuery } from "@/test/convex-mocks"

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

import { PeopleSection } from "@/components/people/people-section"

const m = messages.dashboard.people

// Fixtures

const PEOPLE = [
  {
    personId: "p1",
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
const BY_TITLE = [
  {
    title: "Software Engineer",
    personCount: 2,
    suggestedRoleId: "role1",
    confidence: "high" as const,
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
    confidence: "unmatched" as const,
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
      <PeopleSection />
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
    // Gender should be the localized label (English: "Woman"), not the raw enum value.
    expect(screen.getByText("Woman")).toBeDefined()
    expect(screen.queryByText("Kvinna")).toBeNull()
    expect(screen.getByText("Engineering")).toBeDefined()
    expect(screen.getByText("100%")).toBeDefined()
  })

  it("links the person name cell to the detail route", () => {
    onQuery((ref) => queryRouter(ref))
    renderSection()
    // Alice Svensson (personId "p1") should be a link to /people/p1.
    const link = screen.getByRole("link", { name: "Alice Svensson" })
    expect((link as HTMLAnchorElement).href).toContain("/people/p1")
  })

  it("shows confirmed badge for a person with confirmed assignment", () => {
    onQuery((ref) => queryRouter(ref))
    renderSection()
    expect(screen.getByText(m.badge.confirmed)).toBeDefined()
  })

  it("shows pending badge for a person with suggested assignment", () => {
    onQuery((ref) => queryRouter(ref))
    renderSection()
    expect(screen.getByText(m.badge.pending)).toBeDefined()
  })

  it("shows unclassified badge for a person with no assignment", () => {
    onQuery((ref) => queryRouter(ref))
    renderSection()
    expect(screen.getByText(m.badge.unclassified)).toBeDefined()
  })

  it("renders the summary line with correct classified/total from listPeopleByTitle", () => {
    onQuery((ref) => queryRouter(ref))
    renderSection()
    // 1 confirmed out of 3 total (from flattened BY_TITLE groups)
    expect(screen.getByText("1 of 3 classified")).toBeDefined()
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

  it("links the Classify employees action to /people/classify", () => {
    onQuery((ref) => queryRouter(ref))
    renderSection()
    const link = screen.getByRole("link", { name: m.classifyCta })
    expect((link as HTMLAnchorElement).href).toContain("/people/classify")
  })

  it("keeps the Import link in the header action area", () => {
    onQuery((ref) => queryRouter(ref))
    renderSection()
    const importLinks = screen.getAllByRole("link", { name: m.import.title })
    expect(importLinks.length).toBeGreaterThanOrEqual(1)
  })
})
