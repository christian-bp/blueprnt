import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const pathState = vi.hoisted(() => ({ current: "/people" }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

// Controls what the classification query returns per test (undefined =
// loading, [] = nobody imported).
const useQueryMock = vi.fn()
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    people: {
      classificationQueries: {
        listPeopleByTitle: "people.classificationQueries.listPeopleByTitle",
      },
    },
  },
}))

vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org1", name: "Acme", role: "admin" }),
}))

import { PeopleTabs } from "@/components/people/people-tabs"

const PEOPLE = messages.dashboard.people.tabs.people
const CLASSIFY = messages.dashboard.people.tabs.classify

function renderTabs() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PeopleTabs />
    </NextIntlClientProvider>
  )
}

// One title group: two people, one confirmed and one still unclassified.
const GROUPS = [
  {
    people: [
      { currentAssignment: { levelSource: "confirmed" } },
      { currentAssignment: null },
    ],
  },
]

describe("PeopleTabs", () => {
  beforeEach(() => {
    pathState.current = "/people"
    useQueryMock.mockReturnValue(undefined)
  })
  afterEach(() => {
    cleanup()
    useQueryMock.mockReset()
  })

  it("links People and Classify to their pages", () => {
    renderTabs()
    expect(
      screen.getByRole("link", { name: PEOPLE }).getAttribute("href")
    ).toBe("/people")
    expect(
      screen.getByRole("link", { name: CLASSIFY }).getAttribute("href")
    ).toBe("/people/classify")
  })

  it("marks People as current on /people", () => {
    pathState.current = "/people"
    renderTabs()
    expect(
      screen.getByRole("link", { name: PEOPLE }).getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("link", { name: CLASSIFY }).getAttribute("aria-current")
    ).toBeNull()
  })

  it("keeps People current on a person detail page", () => {
    pathState.current = "/people/anna-svensson"
    renderTabs()
    expect(
      screen.getByRole("link", { name: PEOPLE }).getAttribute("aria-current")
    ).toBe("page")
  })

  it("marks Classify as current on /people/classify", () => {
    pathState.current = "/people/classify"
    renderTabs()
    expect(
      screen.getByRole("link", { name: CLASSIFY }).getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("link", { name: PEOPLE }).getAttribute("aria-current")
    ).toBeNull()
  })

  it("shows the remaining-to-classify count on the Classify tab", () => {
    useQueryMock.mockReturnValue(GROUPS)
    renderTabs()
    // One of the two people is still unconfirmed.
    expect(screen.getByText("1")).toBeDefined()
  })

  it("hides the badge while loading and when everyone is classified", () => {
    useQueryMock.mockReturnValue(undefined)
    const { unmount } = renderTabs()
    expect(screen.queryByText("1")).toBeNull()
    unmount()

    useQueryMock.mockReturnValue([
      { people: [{ currentAssignment: { levelSource: "confirmed" } }] },
    ])
    renderTabs()
    expect(screen.queryByText("0")).toBeNull()
  })
})
