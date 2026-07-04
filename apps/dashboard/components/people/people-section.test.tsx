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
// The import button is a Link: mock next/link with a plain <a>.
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

  it("renders a skeleton when useQuery returns undefined (loading)", () => {
    onQuery(() => undefined)
    renderSection()
    // The empty state text must not appear while loading.
    expect(screen.queryByText(m.empty)).toBeNull()
    // No person data rows visible either.
    expect(screen.queryByText("Alice")).toBeNull()
    // The header import link is always rendered (stable action slot).
    const links = screen.getAllByRole("link", { name: m.import })
    expect(links.length).toBeGreaterThanOrEqual(1)
  })

  it("renders the empty state with an import CTA when useQuery returns []", () => {
    onQuery(() => [])
    renderSection()
    expect(screen.getByText(m.empty)).toBeDefined()
    // Both the header link and the empty-state CTA link are present.
    const links = screen.getAllByRole("link", { name: m.import })
    expect(links.length).toBeGreaterThanOrEqual(1)
    for (const link of links) {
      expect((link as HTMLAnchorElement).href).toContain("/people/import")
    }
  })

  it("renders person rows when useQuery returns a non-empty list", () => {
    onQuery(() => [
      {
        personId: "p1",
        displayName: "Alice Svensson",
        gender: "Kvinna",
        department: "Engineering",
        ftePercent: 100,
        externalRef: null,
        birthDate: null,
        employmentStartDate: null,
        country: null,
        isManager: null,
        statisticalCode: null,
        archivedAt: null,
      },
    ])
    renderSection()
    expect(screen.getByText("Alice Svensson")).toBeDefined()
    // Gender should be the localized label (English: "Woman"), not the raw enum value.
    expect(screen.getByText("Woman")).toBeDefined()
    expect(screen.queryByText("Kvinna")).toBeNull()
    expect(screen.getByText("Engineering")).toBeDefined()
    // FTE should be rendered as a percentage string.
    expect(screen.getByText("100%")).toBeDefined()
  })
})
