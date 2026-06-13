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

import OverviewPage from "@/app/(app)/page"

const t = messages.dashboard.overview.continueScoring

function results(rows: Array<{ complete: boolean }>) {
  return {
    rows: rows.map((row, index) => ({
      roleId: `role-${index}`,
      title: "Role",
      trackKey: "IC",
      trackName: "IC",
      status: "draft",
      complete: row.complete,
      ratedCount: row.complete ? 5 : 0,
      totalCriteria: 5,
      score: null,
      band: null,
      familyId: null,
      familyName: null,
    })),
    bands: [],
  }
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OverviewPage />
    </NextIntlClientProvider>
  )
}

describe("OverviewPage continue-scoring card", () => {
  beforeEach(() => useQueryMock.mockReset())
  afterEach(() => cleanup())

  it("shows the card with X of Y when some roles are unscored", () => {
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "assessment.results.getResults")
        return results([{ complete: true }, { complete: false }])
      if (ref === "assessment.roles.listRoles") return []
      return { criteria: [] }
    })
    renderPage()
    expect(screen.getByText(t.title)).toBeDefined()
    expect(
      screen.getByText(
        t.progress.replace("{scored}", "1").replace("{total}", "2")
      )
    ).toBeDefined()
  })

  it("hides the card when every role is complete", () => {
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "assessment.results.getResults")
        return results([{ complete: true }, { complete: true }])
      if (ref === "assessment.roles.listRoles") return []
      return { criteria: [] }
    })
    renderPage()
    expect(screen.queryByText(t.title)).toBeNull()
  })

  it("hides the card when there are no roles", () => {
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "assessment.results.getResults") return results([])
      if (ref === "assessment.roles.listRoles") return []
      return { criteria: [] }
    })
    renderPage()
    expect(screen.queryByText(t.title)).toBeNull()
  })
})
