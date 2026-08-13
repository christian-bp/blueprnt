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
// AssistantPrompt (rendered on this page) reads the router for its
// post-send navigation; none of these tests exercise sending, so a no-op
// push is enough to satisfy the hook.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

import OverviewPage from "@/app/(app)/page"

const tOverview = messages.dashboard.overview

// A fully-loaded fixture with buildTodo total === 0: one confirmed person
// staffed on a role that carries zero criteria. Such a role never resolves
// a level (blocking the pay-mapping gate) but sits in no buildTodo group at
// all (profileComplete so not "describe"; ratedCount(0) < totalCriteria(0)
// is false so not "evaluate" either), so nothing is left to do. No model,
// no pay-mapping history, and no results (so the level-distribution widget
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
                senioritySource: "confirmed",
              },
            },
          ],
        },
      ]
    if (ref === "payMapping.runs.listPayMappingRuns") return []
    if (ref === "assessment.results.getResults") return { rows: [], levels: [] }
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
    if (ref === "assessment.results.getResults") return { rows: [], levels: [] }
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

  it("renders a hero status skeleton and section skeletons while queries are loading, with the to-do row holding its shape", () => {
    useQueryMock.mockReturnValue(undefined)
    renderPage()
    // Skeleton bars are present (data-slot="skeleton") in place of the
    // subtitle's count and the sections' data-driven content.
    expect(document.querySelector("[data-slot='skeleton']")).not.toBeNull()
    expect(screen.queryByText(/right now\./)).toBeNull()
    // The row's heading names what the row holds, which is data too, so it
    // waits with the cards rather than claiming work is outstanding and
    // renaming itself when the query lands.
    expect(screen.queryByText(tOverview.sectionTodo)).toBeNull()
    expect(screen.queryByText(tOverview.sectionQuickActions)).toBeNull()
    // The to-do row waits rather than showing destinations it may replace:
    // which cards it holds is data, so it renders four skeleton slots and
    // nothing moves when the real ones arrive.
    expect(
      screen.queryByRole("link", {
        name: tOverview.quickActions.importEmployees.label,
      })
    ).toBeNull()
  })

  it("resolves the hero status line's singular and plural branches, each linking to the To do section", () => {
    // A fresh, truly empty org: the importPeople row is buildTodo's single
    // outstanding item (the "one" branch).
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "assessment.roles.listRoles") return []
      if (ref === "evaluationModel.method.getMethodModel") return null
      if (ref === "people.classificationQueries.listPeopleByTitle") return []
      if (ref === "payMapping.runs.listPayMappingRuns") return []
      if (ref === "assessment.results.getResults")
        return { rows: [], levels: [] }
      return undefined
    })
    const { unmount } = renderPage()
    const singularLink = screen.getByRole("link", { name: "1 thing to do" })
    expect(singularLink.getAttribute("href")).toBe("#todo")
    unmount()

    // Two imported titles awaiting classification: the "other" branch.
    mockWorkFixture()
    renderPage()
    expect(screen.getByRole("link", { name: "2 things to do" })).toBeDefined()
  })

  it("falls back to the all-caught-up line when nothing is outstanding", () => {
    mockNeutralQueries()
    renderPage()
    expect(
      screen.getByText(
        "You're all caught up. Nothing needs your attention right now."
      )
    ).toBeDefined()
  })

  it("renders the hero in document order: greeting, then the status line, then the assistant prompt", () => {
    mockWorkFixture()
    renderPage()
    const heading = screen.getByRole("heading", { level: 1 })
    const link = screen.getByRole("link", { name: "2 things to do" })
    const input = screen.getByPlaceholderText(
      messages.dashboard.assistant.inputPlaceholder
    )
    expect(
      heading.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      link.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
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
    // The stat strip carries no heading of its own: four labelled figures
    // need no label above them.
    expect(screen.getByText(tOverview.widgets.workforce.label)).toBeDefined()
  })

  it("falls back to the standing destinations in the To do row, and still renders the stat strip, when there is no work", () => {
    mockNeutralQueries()
    renderPage()
    expect(
      screen.getByText(tOverview.quickActions.importEmployees.label)
    ).toBeDefined()
    // Nothing is waiting, so the band is not a to-do list and does not say it
    // is: the heading names the destinations it now holds.
    expect(
      screen.getByRole("heading", { name: tOverview.sectionQuickActions })
    ).toBeDefined()
    expect(screen.queryByText(tOverview.sectionTodo)).toBeNull()
    expect(screen.getByText(tOverview.widgets.workforce.label)).toBeDefined()
    expect(screen.getByText(tOverview.widgets.levels.label)).toBeDefined()
    expect(screen.getByText(tOverview.widgets.gap.label)).toBeDefined()
  })

  // The two trend panels (workforce and pay gap over time) moved into the
  // assistant; the overview itself carries only the stat strip's figures.
  // A TrendPanel renders its title in every state (loading, empty, ready),
  // so this holds regardless of which fixture is mocked.
  it("no longer renders the workforce or pay-gap trend charts", () => {
    mockNeutralQueries()
    renderPage()
    expect(
      screen.queryByText(tOverview.widgets.workforce.trendTitle)
    ).toBeNull()
    expect(screen.queryByText(tOverview.widgets.gapTrend.title)).toBeNull()
  })

  // The hero fills roughly one viewport and centers its content within it,
  // so the greeting, status line, and chat prompt land in the first screen
  // rather than wherever normal flow happens to put them.
  it("pins the hero to roughly the viewport height and centers its content", () => {
    mockNeutralQueries()
    const { container } = renderPage()
    const page = container.querySelector("div.flex.flex-col")
    const hero = page?.firstElementChild
    expect(hero?.className).toMatch(/min-h-/)
    expect(hero?.className).toMatch(/vh/)
    expect(hero?.className).toContain("justify-center")
  })

  // The AI chat prompt must span the same width as the To do row and the
  // stat strip below it, not a narrower centered column: no `max-w` cap
  // between the page's own container and the AssistantPrompt.
  it("gives the hero the same full content width as the To do row and the stat strip", () => {
    mockNeutralQueries()
    const { container } = renderPage()
    const page = container.querySelector("div.flex.flex-col")
    const hero = page?.firstElementChild
    expect(hero?.className).not.toMatch(/max-w/)
  })

  // One spacing rhythm for the page: the gap BETWEEN the bands is the same as
  // the gap between the widgets inside them, in both directions. The page used
  // to stack its bands 32px apart while its cards sat 12px apart, so the same
  // cards were spaced differently depending on which way you read them.
  it("spaces every band and every widget grid by the same gap", () => {
    mockNeutralQueries()
    const { container } = renderPage()

    const page = container.querySelector("div.flex.flex-col")
    expect(page?.className).toContain("gap-4")

    // Each band that lays widgets out in a grid, plus the to-do section's own
    // heading-to-cards stack. None may carry a different gap.
    const bands = [
      ...(page?.querySelectorAll("div.grid, section") ?? []),
    ].filter((el) => !el.className.includes("card-header"))
    expect(bands.length).toBeGreaterThanOrEqual(3)
    for (const band of bands) {
      expect(band.className).toContain("gap-4")
    }
  })
})
