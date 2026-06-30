import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AnchorRoleInfo } from "@/components/roles/role-anchor-control"
import { onQuery } from "@/test/convex-mocks"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

import { RoleEvaluationCard } from "@/components/roles/role-evaluation-card"

const detail = messages.dashboard.roles.detail
const roles = messages.dashboard.roles

type Result = {
  roleId: string
  title: string
  complete: boolean
  ratedCount: number
  totalCriteria: number
  score: number | null
  band: number | null
  criteria: {
    criterionId: string
    name: string
    weightPoints: number
    value: number | null
    motivation: string | null
  }[]
}

function setResult(next: Result | null) {
  onQuery((ref) =>
    ref === "assessment.results.getRoleResult" ? next : undefined
  )
}

function renderCard(
  props: {
    archived?: boolean
    profileComplete?: boolean
    ratedCount?: number
    totalCriteria?: number
    anchorRole?: AnchorRoleInfo | null
    isAdmin?: boolean
  } = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleEvaluationCard
        orgId="org_1"
        roleId={"role_1" as never}
        slug="r1"
        archived={props.archived ?? false}
        profileComplete={props.profileComplete ?? true}
        ratedCount={props.ratedCount ?? 0}
        totalCriteria={props.totalCriteria ?? 5}
        anchorRole={props.anchorRole ?? null}
        isAdmin={props.isAdmin ?? false}
      />
    </NextIntlClientProvider>
  )
}

describe("RoleEvaluationCard", () => {
  beforeEach(() => setResult(null))
  afterEach(() => cleanup())

  it("states the precondition and offers no rate action when the profile is incomplete", () => {
    renderCard({ profileComplete: false, ratedCount: 0, totalCriteria: 5 })
    expect(screen.getByText(detail.profileIncomplete)).toBeDefined()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("offers Rate role when complete and nothing is rated", () => {
    renderCard({ ratedCount: 0, totalCriteria: 5 })
    const link = screen.getByRole("link", { name: detail.rateCta })
    expect(link.getAttribute("href")).toBe("/roles/r1/rate")
  })

  it("offers Continue while partially rated", () => {
    renderCard({ ratedCount: 2, totalCriteria: 5 })
    expect(
      screen.getByRole("link", { name: detail.resumeRateCta })
    ).toBeDefined()
  })

  it("shows the weighting, band, breakdown, and Adjust once complete", () => {
    setResult({
      roleId: "role_1",
      title: "Engineer",
      complete: true,
      ratedCount: 3,
      totalCriteria: 3,
      score: 71,
      band: 3,
      criteria: [
        {
          criterionId: "scope",
          name: "Scope",
          weightPoints: 5,
          value: 3,
          motivation: null,
        },
        {
          criterionId: "complexity",
          name: "Complexity",
          weightPoints: 4,
          value: 5,
          motivation: null,
        },
        {
          criterionId: "people",
          name: "People",
          weightPoints: 2,
          value: 1,
          motivation: null,
        },
      ],
    })
    renderCard({ ratedCount: 3, totalCriteria: 3 })
    expect(screen.getByText("71 / 100")).toBeDefined()
    expect(screen.getByText("Band 3")).toBeDefined()
    expect(screen.getByText("Complexity")).toBeDefined()
    expect(
      screen.getByRole("link", { name: detail.adjustRateCta })
    ).toBeDefined()
  })

  it("stays read-only for an archived role (no rate action)", () => {
    renderCard({ archived: true, ratedCount: 5, totalCriteria: 5 })
    expect(screen.getByText(roles.evaluated)).toBeDefined()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("shows the computing placeholder while a fully-rated result is still loading", () => {
    renderCard({ ratedCount: 3, totalCriteria: 3 })
    expect(
      screen.getByText(messages.dashboard.rating.result.computing)
    ).toBeDefined()
  })

  it("shows the anchor control for an admin once complete, not in the progress state", () => {
    setResult({
      roleId: "role_1",
      title: "Engineer",
      complete: true,
      ratedCount: 3,
      totalCriteria: 3,
      score: 71,
      band: 3,
      criteria: [
        {
          criterionId: "scope",
          name: "Scope",
          weightPoints: 5,
          value: 3,
          motivation: null,
        },
      ],
    })
    renderCard({ ratedCount: 3, totalCriteria: 3, isAdmin: true })
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.roles.anchor.designateCta,
      })
    ).toBeDefined()
  })
})
