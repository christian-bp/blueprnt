import { cleanup, fireEvent, render, screen } from "@testing-library/react"
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
const anchor = messages.dashboard.roles.anchor

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

const completeResult: Result = {
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
}

const designated: AnchorRoleInfo = {
  expectedBand: 2,
  motivation: "Reference role for the platform track",
  status: "active",
  reviewedAt: 1_700_000_000_000,
}

// getRoleResult drives the view; getModel/listAnchorRoles back the dialog when
// an admin opens it.
function setResult(next: Result | null) {
  onQuery((ref) => {
    if (ref === "assessment.results.getRoleResult") return next
    if (ref === "evaluationModel.model.getModel")
      return { bandThresholds: [80, 60, 40, 20] }
    if (ref === "assessment.anchorRoles.listAnchorRoles") return []
    return undefined
  })
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

function openMenu() {
  const trigger = screen.getByRole("button", {
    name: detail.manageCta,
  })
  fireEvent.pointerDown(trigger)
  fireEvent.click(trigger)
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

  it("shows the weighting, band, and breakdown once complete", () => {
    setResult(completeResult)
    renderCard({ ratedCount: 3, totalCriteria: 3 })
    expect(screen.getByText("Weighting 71")).toBeDefined()
    expect(screen.getByText("Band 3")).toBeDefined()
    expect(screen.getByText("Complexity")).toBeDefined()
  })

  it("puts Adjust ratings in the actions menu, not as a body button", () => {
    setResult(completeResult)
    renderCard({ ratedCount: 3, totalCriteria: 3 })
    // No standalone Adjust link in the card body.
    expect(
      screen.queryByRole("link", { name: detail.adjustRateCta })
    ).toBeNull()
    openMenu()
    const adjust = screen.getByRole("menuitem", { name: detail.adjustRateCta })
    expect(adjust.getAttribute("href")).toBe("/roles/r1/rate")
  })

  it("offers Designate in the menu for an admin with no anchor, and shows no status row", () => {
    setResult(completeResult)
    renderCard({
      ratedCount: 3,
      totalCriteria: 3,
      isAdmin: true,
      anchorRole: null,
    })
    expect(screen.queryByText(anchor.heading)).toBeNull()
    openMenu()
    expect(
      screen.getByRole("menuitem", { name: anchor.designateCta })
    ).toBeDefined()
  })

  it("shows the anchor status inline and Manage in the menu for an admin on a designated role", () => {
    setResult(completeResult)
    renderCard({
      ratedCount: 3,
      totalCriteria: 3,
      isAdmin: true,
      anchorRole: designated,
    })
    expect(screen.getByText(anchor.statusActive)).toBeDefined()
    expect(
      screen.getByText("Reference role for the platform track")
    ).toBeDefined()
    openMenu()
    expect(
      screen.getByRole("menuitem", { name: anchor.manageCta })
    ).toBeDefined()
  })

  it("gives a non-admin only Adjust in the menu but still shows a designated anchor's status", () => {
    setResult(completeResult)
    renderCard({
      ratedCount: 3,
      totalCriteria: 3,
      isAdmin: false,
      anchorRole: designated,
    })
    expect(screen.getByText(anchor.statusActive)).toBeDefined()
    openMenu()
    expect(
      screen.getByRole("menuitem", { name: detail.adjustRateCta })
    ).toBeDefined()
    expect(
      screen.queryByRole("menuitem", { name: anchor.manageCta })
    ).toBeNull()
  })

  it("stays read-only for an archived role (no rate action, no menu)", () => {
    renderCard({ archived: true, ratedCount: 5, totalCriteria: 5 })
    expect(screen.getByText(roles.evaluated)).toBeDefined()
    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.queryByRole("button", { name: detail.manageCta })).toBeNull()
  })

  it("shows the computing placeholder while a fully-rated result is still loading", () => {
    renderCard({ ratedCount: 3, totalCriteria: 3 })
    expect(
      screen.getByText(messages.dashboard.rating.result.computing)
    ).toBeDefined()
  })

  it("renders no actions menu in the progress state", () => {
    renderCard({ ratedCount: 2, totalCriteria: 5 })
    expect(screen.queryByRole("button", { name: detail.manageCta })).toBeNull()
  })
})
