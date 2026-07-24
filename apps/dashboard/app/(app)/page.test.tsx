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

const tTodo = messages.dashboard.overview.todo

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

  it("renders skeletons while queries are loading", () => {
    // Both queries return undefined (loading state): TodoWidget shows TodoSkeleton.
    useQueryMock.mockReturnValue(undefined)
    renderPage()
    // Skeleton elements are present (data-slot="skeleton"); no heading text yet.
    expect(document.querySelector("[data-slot='skeleton']")).not.toBeNull()
  })

  it("renders the empty-state message when there is nothing to do", () => {
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "assessment.roles.listRoles") return []
      if (ref === "evaluationModel.method.getMethodModel") return null
      // One classified person, so the org is not empty (an empty org shows
      // the importPeople group instead of the all-caught-up state).
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
      // A non-completed run in flight: with everything above clear, the gate
      // would otherwise be ready and add its own group.
      if (ref === "payMapping.runs.listPayMappingRuns")
        return [{ status: "active" }]
      return undefined
    })
    renderPage()
    expect(screen.getByText(tTodo.empty.title)).toBeDefined()
  })

  it("renders the sample chart card", () => {
    // The chart uses static sample data, so it renders regardless of queries.
    useQueryMock.mockReturnValue(undefined)
    renderPage()
    expect(
      screen.getByText(messages.dashboard.overview.chart.title)
    ).toBeDefined()
  })
})
