import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AnchorRoleInfo } from "@/components/roles/role-anchor-control"
import { mockMutation, onQuery } from "@/test/convex-mocks"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

import { RoleEvaluationCard } from "@/components/roles/role-evaluation-card"
import { openMenu } from "@/test/menu"

const unlockAssessmentMock = mockMutation("assessment.locking.unlockAssessment")

const detail = messages.dashboard.roles.detail
const roles = messages.dashboard.roles
const anchor = messages.dashboard.roles.anchor

type Result = {
  roleId: string
  title: string
  complete: boolean
  locked: boolean
  methodDrift?: boolean
  calibrated?: boolean
  ratedCount: number
  totalCriteria: number
  score: number | null
  level: number | null
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
  locked: true,
  ratedCount: 3,
  totalCriteria: 3,
  score: 71,
  level: 3,
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

// Complete but not yet locked: the "ready to lock" state (spec 2.4/6),
// distinct from the locked-results state `completeResult` represents.
const readyToLockResult: Result = { ...completeResult, locked: false }

const designated: AnchorRoleInfo = {
  expectedLevel: 2,
  motivation: "Reference role for the platform track",
  status: "active",
  reviewedAt: 1_700_000_000_000,
}

// getRoleResult drives the view; getModel/listAnchorRoles back the dialog when
// an admin opens it.
function setResult(next: Result | null | undefined) {
  onQuery((ref) => {
    if (ref === "assessment.results.getRoleResult") return next
    if (ref === "evaluationModel.model.getModel")
      return { levelRules: [80, 60, 40, 20] }
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
      />
    </NextIntlClientProvider>
  )
}

function openManageMenu() {
  return openMenu(screen.getByRole("button", { name: detail.manageCta }))
}

describe("RoleEvaluationCard", () => {
  beforeEach(() => {
    setResult(null)
    unlockAssessmentMock.mockReset().mockResolvedValue(null)
  })
  afterEach(() => cleanup())

  it("states the precondition and offers no rate action when the profile is incomplete", () => {
    renderCard({ profileComplete: false, ratedCount: 0, totalCriteria: 5 })
    expect(screen.getByText(detail.profileIncompleteTitle)).toBeDefined()
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

  it("shows the weighting, level, and breakdown once locked", () => {
    setResult(completeResult)
    renderCard({ ratedCount: 3, totalCriteria: 3 })
    expect(screen.getByText("Weighting 71")).toBeDefined()
    expect(screen.getByText("Level 3")).toBeDefined()
    expect(screen.getByText("Complexity")).toBeDefined()
    expect(screen.getByText(detail.lockedBadge)).toBeDefined()
  })

  // Rated but not completed. This card SAYS what is left and points into the
  // flow; it does not carry the act. Completing from here was the second trip
  // decision 14 removed, so a button that completed from outside the flow
  // would be that errand growing back.
  it("sends a complete-but-uncompleted role into the flow rather than completing it here", () => {
    setResult(readyToLockResult)
    renderCard({ ratedCount: 3, totalCriteria: 3 })
    expect(
      screen.getByText(messages.dashboard.rating.completeExplanation)
    ).toBeDefined()
    const into = screen.getByRole("link", {
      name: messages.dashboard.rating.completeCta,
    })
    expect(into.getAttribute("href")).toBe("/roles/r1/rate")
    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.rating.completeCta,
      })
    ).toBeNull()
    expect(screen.queryByText("Weighting 71")).toBeNull()
    expect(screen.queryByText(detail.lockedBadge)).toBeNull()
  })

  it("flags method drift on a locked role with a stale-method chip", () => {
    setResult({ ...completeResult, methodDrift: true })
    renderCard({ ratedCount: 3, totalCriteria: 3 })
    expect(screen.getByText(detail.methodDriftBadge)).toBeDefined()
  })

  it("leaves the stale-method chip off a role locked under the current method", () => {
    setResult({ ...completeResult, methodDrift: false })
    renderCard({ ratedCount: 3, totalCriteria: 3 })
    expect(screen.queryByText(detail.methodDriftBadge)).toBeNull()
  })

  it("marks a confirmed placement as calibrated, and an unconfirmed one not", () => {
    setResult(completeResult)
    renderCard({ ratedCount: 3, totalCriteria: 3 })
    expect(screen.queryByText(detail.calibratedBadge)).toBeNull()
    cleanup()
    setResult({ ...completeResult, calibrated: true })
    renderCard({ ratedCount: 3, totalCriteria: 3 })
    expect(screen.getByText(detail.calibratedBadge)).toBeDefined()
  })

  it("says a locked role carries an unrated criterion instead of claiming to compute", () => {
    // A criterion activated after the lock leaves the role locked and
    // incomplete at once. Nothing computes in that state, so the card must
    // not show the computing placeholder it shows while a query is in flight.
    setResult({
      ...completeResult,
      complete: false,
      score: null,
      level: null,
    })
    renderCard({ ratedCount: 3, totalCriteria: 3 })
    expect(screen.getByText(detail.lockedIncomplete)).toBeDefined()
    expect(screen.getByText(detail.lockedBadge)).toBeDefined()
    expect(
      screen.queryByText(messages.dashboard.rating.result.computing)
    ).toBeNull()
    expect(screen.queryByText("Weighting 71")).toBeNull()
  })

  it("puts Adjust ratings in the actions menu for a ready-to-lock role, not as a body button", async () => {
    setResult(readyToLockResult)
    renderCard({ ratedCount: 3, totalCriteria: 3 })
    // No standalone Adjust link in the card body.
    expect(
      screen.queryByRole("link", { name: detail.adjustRateCta })
    ).toBeNull()
    await openManageMenu()
    const adjust = screen.getByRole("menuitem", { name: detail.adjustRateCta })
    expect(adjust.getAttribute("href")).toBe("/roles/r1/rate")
  })

  // One press, straight to the mutation: decision 14 retired the confirm, so a
  // dialog appearing between the click and the write would be the ceremony
  // growing back.
  it("reopens from the actions menu in one press, with no confirm in between", async () => {
    setResult(completeResult)
    renderCard({ ratedCount: 3, totalCriteria: 3 })
    expect(
      screen.queryByRole("menuitem", { name: detail.adjustRateCta })
    ).toBeNull()
    await openManageMenu()
    const reopen = screen.getByRole("menuitem", {
      name: messages.dashboard.rating.reopenCta,
    })
    fireEvent.click(reopen)
    await waitFor(() => {
      expect(unlockAssessmentMock).toHaveBeenCalledWith({
        orgId: "org_1",
        roleId: "role_1",
      })
    })
  })

  it("offers Designate in the menu when there is no anchor, and shows no status row", async () => {
    setResult(completeResult)
    renderCard({
      ratedCount: 3,
      totalCriteria: 3,
      anchorRole: null,
    })
    expect(screen.queryByText(anchor.heading)).toBeNull()
    await openManageMenu()
    expect(
      screen.getByRole("menuitem", { name: anchor.designateCta })
    ).toBeDefined()
  })

  it("leads with the computed level and flags the anchor deviation", async () => {
    setResult(completeResult)
    renderCard({
      ratedCount: 3,
      totalCriteria: 3,
      anchorRole: designated,
    })
    // The computed level (3) is the headline, not the agreed level (2).
    expect(screen.getByText("Level 3")).toBeDefined()
    // The agreed level appears only as the deviation flag (score is primary).
    const deviation = messages.dashboard.levels.deviation.replace(
      "{level}",
      "2"
    )
    expect(screen.getByText(deviation)).toBeDefined()
    // The level carries the anchor concept help.
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.help.anchorRoleLabel,
      })
    ).toBeDefined()
    // The anchor's motivation is shown under the level.
    expect(
      screen.getByText("Reference role for the platform track")
    ).toBeDefined()
    await openManageMenu()
    expect(
      screen.getByRole("menuitem", { name: anchor.manageCta })
    ).toBeDefined()
  })

  it("hides Designate from the menu on a complete-but-unlocked role", async () => {
    setResult(readyToLockResult)
    renderCard({
      ratedCount: 3,
      totalCriteria: 3,
      anchorRole: null,
    })
    // Lock-as-reveal: the backend refuses designation until the role is
    // locked, so the affordance stays off the menu until then too.
    await openManageMenu()
    expect(
      screen.queryByRole("menuitem", { name: anchor.designateCta })
    ).toBeNull()
  })

  // Anchor work needs a locked reference, so a ready-to-lock role offers only
  // Adjust whoever is looking: the gate is the lock, never the role.
  it("gives only Adjust in the menu for a ready-to-lock anchor role", async () => {
    setResult(readyToLockResult)
    renderCard({
      ratedCount: 3,
      totalCriteria: 3,
      anchorRole: designated,
    })
    // Not yet locked: the level is not revealed (lock-as-reveal), but the
    // ready-to-lock panel confirms the role is still marked as an anchor
    // candidate via the menu below.
    expect(screen.queryByText("Level 3")).toBeNull()
    await openManageMenu()
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
    setResult(undefined)
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
