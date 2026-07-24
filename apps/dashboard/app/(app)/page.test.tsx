import { cleanup, render, screen } from "@testing-library/react"
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
// WelcomeGreeting reads the session and clock; stub both to keep the test simple.
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { name: "Ada Lovelace" } } }),
  },
}))

import OverviewPage from "@/app/(app)/page"

const tOverview = messages.dashboard.overview

// A fully-loaded fixture with buildTodo total === 0: one confirmed person
// staffed on a role that carries zero criteria. Such a role never resolves
// a band (blocking the pay-mapping gate) but sits in no buildTodo group at
// all (profileComplete so not "describe"; ratedCount(0) < totalCriteria(0)
// is false so not "evaluate" either), so nothing is left to do. No model,
// no pay-mapping history, and no results (so the band-distribution widget
// falls back to its empty narrative rather than staying in its own
// perpetual skeleton).
function mockNeutralQueries() {
  useQueryMock.mockImplementation((ref: string) => {
    if (ref === "assessment.roles.listRoles")
      return [
        {
          roleId: "r-neutral",
          title: "Engineer",
          slug: "engineer",
          ratedCount: 0,
          totalCriteria: 0,
          profileComplete: true,
          familyName: null,
        },
      ]
    if (ref === "evaluationModel.method.getMethodModel") return null
    if (ref === "people.classificationQueries.listPeopleByTitle")
      return [
        {
          title: "Engineer",
          people: [
            {
              currentAssignment: {
                roleId: "r-neutral",
                levelSource: "confirmed",
              },
            },
          ],
        },
      ]
    if (ref === "payMapping.runs.listPayMappingRuns") return []
    if (ref === "assessment.results.getResults") return { rows: [], bands: [] }
    return undefined
  })
}

// Two imported titles still awaiting classification: buildTodo's
// classifyPeople group is non-empty, so the "To do" section renders a
// group card instead of the all-caught-up line.
function mockWorkFixture() {
  useQueryMock.mockImplementation((ref: string) => {
    if (ref === "assessment.roles.listRoles") return []
    if (ref === "evaluationModel.method.getMethodModel") return null
    if (ref === "people.classificationQueries.listPeopleByTitle")
      return [
        { title: "Sales Manager", people: [{ currentAssignment: null }] },
        { title: "Support Lead", people: [{ currentAssignment: null }] },
      ]
    if (ref === "payMapping.runs.listPayMappingRuns") return []
    if (ref === "assessment.results.getResults") return { rows: [], bands: [] }
    return undefined
  })
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OverviewPage />
    </NextIntlClientProvider>
  )
}

describe("OverviewPage", () => {
  beforeEach(() => useQueryMock.mockReset())
  afterEach(() => cleanup())

  it("renders a subtitle skeleton and section skeletons while queries are loading, with quick actions' static chrome already real", () => {
    useQueryMock.mockReturnValue(undefined)
    renderPage()
    // Skeleton bars are present (data-slot="skeleton") in place of the
    // subtitle's count and the sections' data-driven content.
    expect(document.querySelector("[data-slot='skeleton']")).not.toBeNull()
    expect(screen.queryByText(/right now\./)).toBeNull()
    // The section labels are static i18n text, so they render for real even
    // while their data is still loading.
    expect(screen.getByText(tOverview.sectionTodo)).toBeDefined()
    expect(screen.getByText(tOverview.sectionOverview)).toBeDefined()
    // Quick actions carry no data dependency, so they render for real even
    // while the queries are still loading.
    expect(
      screen.getByRole("link", { name: tOverview.quickActions.importEmployees })
    ).toBeDefined()
  })

  it("resolves the subtitle's other two ICU plural branches (one, other)", () => {
    // A fresh, truly empty org: the importPeople row is buildTodo's single
    // outstanding item (the "one" branch).
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "assessment.roles.listRoles") return []
      if (ref === "evaluationModel.method.getMethodModel") return null
      if (ref === "people.classificationQueries.listPeopleByTitle") return []
      if (ref === "payMapping.runs.listPayMappingRuns") return []
      if (ref === "assessment.results.getResults")
        return { rows: [], bands: [] }
      return undefined
    })
    const { unmount } = renderPage()
    expect(screen.getByText("You have 1 item waiting right now.")).toBeDefined()
    unmount()

    // Two imported titles awaiting classification: the "other" branch.
    mockWorkFixture()
    renderPage()
    expect(
      screen.getByText("You have 2 items waiting right now.")
    ).toBeDefined()
  })

  it("renders the To do section's work group and the Overview section's widgets when there is work outstanding", () => {
    mockWorkFixture()
    renderPage()
    expect(
      screen.getByRole("heading", { name: tOverview.sectionTodo })
    ).toBeDefined()
    // The classifyPeople group card is the to-do work item this fixture
    // produces.
    expect(screen.getByText(tOverview.todo.groups.classifyPeople)).toBeDefined()
    expect(
      screen.getByRole("heading", { name: tOverview.sectionOverview })
    ).toBeDefined()
    expect(screen.getByText(tOverview.widgets.workforce.label)).toBeDefined()
  })

  it("shows the all-caught-up line in the To do section and still renders the Overview widgets when there is no work", () => {
    mockNeutralQueries()
    renderPage()
    expect(screen.getByText(tOverview.todo.empty.title)).toBeDefined()
    expect(screen.getByText(tOverview.widgets.workforce.label)).toBeDefined()
    expect(screen.getByText(tOverview.widgets.bands.label)).toBeDefined()
    expect(screen.getByText(tOverview.widgets.gap.label)).toBeDefined()
  })
})
