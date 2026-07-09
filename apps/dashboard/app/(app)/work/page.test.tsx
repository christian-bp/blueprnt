import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
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
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: "admin" }),
}))

import WorkOverviewPage from "@/app/(app)/work/page"

function bandRow(overrides: Record<string, unknown>) {
  return {
    roleId: "r1",
    title: "CTO",
    trackKey: "M",
    trackName: "Manager",
    status: "approved",
    complete: true,
    ratedCount: 9,
    totalCriteria: 9,
    score: 90,
    band: 1,
    familyId: null,
    familyName: null,
    anchor: null,
    ...overrides,
  }
}

function results(rows: Array<Record<string, unknown>>) {
  return {
    rows,
    bands: [
      { band: 1, minScore: 80 },
      { band: 2, minScore: 0 },
    ],
  }
}

function page() {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <WorkOverviewPage />
    </NextIntlClientProvider>
  )
}

function renderPage() {
  return render(page())
}

describe("WorkOverviewPage", () => {
  beforeEach(() => useQueryMock.mockReset())
  afterEach(() => cleanup())

  it("shows the empty state when there are no roles", () => {
    useQueryMock.mockImplementation((ref: string) =>
      ref === "assessment.results.getResults" ? results([]) : undefined
    )
    renderPage()
    expect(screen.getByText(messages.dashboard.bands.empty)).toBeDefined()
  })

  it("renders the ladder with both view toggles when roles exist", () => {
    useQueryMock.mockImplementation((ref: string) =>
      ref === "assessment.results.getResults"
        ? results([bandRow({})])
        : undefined
    )
    renderPage()
    expect(screen.getByText(messages.dashboard.bands.viewLadder)).toBeDefined()
    expect(screen.getByText(messages.dashboard.bands.viewMatrix)).toBeDefined()
    // Ladder is the default view: the role chip is on screen.
    expect(screen.getByRole("link", { name: /CTO/ })).toBeDefined()
    expect(screen.getByText("Band 1")).toBeDefined()
  })

  it("keeps the ladder view selected when the results arrive after loading", () => {
    // Loading first: the page renders its real tabs over the skeleton. The
    // Tabs instance persists across the branch swap (same tree position), so
    // the selection must survive it or the loaded page shows no view at all.
    useQueryMock.mockImplementation(() => undefined)
    const { rerender } = renderPage()
    expect(screen.getByText(messages.dashboard.bands.viewLadder)).toBeDefined()

    useQueryMock.mockImplementation((ref: string) =>
      ref === "assessment.results.getResults"
        ? results([bandRow({})])
        : undefined
    )
    rerender(page())
    expect(screen.getByRole("link", { name: /CTO/ })).toBeDefined()
    expect(screen.getByText("Band 1")).toBeDefined()
  })

  it("the families view shows family rows with roles in band columns and hides the group toggle", async () => {
    useQueryMock.mockImplementation((ref: string) =>
      ref === "assessment.results.getResults"
        ? results([
            bandRow({ familyId: "f1", familyName: "Engineering" }),
            bandRow({
              roleId: "r2",
              title: "Analyst",
              band: 2,
              familyId: null,
              familyName: null,
            }),
          ])
        : undefined
    )
    renderPage()
    // The toggle exists on the ladder view...
    expect(
      screen.getByText(messages.dashboard.bands.groupByFamily)
    ).toBeDefined()

    fireEvent.click(
      screen.getByRole("tab", { name: messages.dashboard.bands.viewFamilies })
    )
    // ...and hides on the families view, where family IS the row axis.
    await waitFor(() => {
      expect(
        screen.queryByText(messages.dashboard.bands.groupByFamily)
      ).toBeNull()
    })
    // One row per family (the family-less bucket included), roles as chips.
    expect(screen.getByRole("rowheader", { name: "Engineering" })).toBeDefined()
    expect(
      screen.getByRole("rowheader", {
        name: messages.dashboard.roles.family.none,
      })
    ).toBeDefined()
    expect(screen.getByRole("columnheader", { name: "Band 1" })).toBeDefined()
    expect(screen.getAllByRole("link", { name: /CTO/ }).length).toBeGreaterThan(
      0
    )
  })

  it("offers a group-by-family toggle when roles have families", () => {
    useQueryMock.mockImplementation((ref: string) =>
      ref === "assessment.results.getResults"
        ? results([bandRow({ familyId: "f1", familyName: "Engineering" })])
        : undefined
    )
    renderPage()
    expect(
      screen.getByText(messages.dashboard.bands.groupByFamily)
    ).toBeDefined()
  })
})
