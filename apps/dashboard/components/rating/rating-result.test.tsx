import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

import { RatingResult } from "@/components/rating/rating-result"
import { onQuery } from "@/test/convex-mocks"

const labels = messages.dashboard.rating.result

// A fully complete result. The score is the normalized 0-100 integer
// (ADR-0004).
const COMPLETE_RESULT = {
  roleId: "role-1",
  title: "Senior Engineer",
  complete: true,
  locked: true,
  ratedCount: 2,
  totalCriteria: 2,
  score: 74,
  level: 2,
  criteria: [
    {
      criterionId: "c-scope",
      name: "Scope",
      weightPoints: 4,
      value: 4,
      motivation: null,
    },
    {
      criterionId: "c-risk",
      name: "Risk",
      weightPoints: 2,
      value: 3,
      motivation: "Moderate risk exposure",
    },
  ],
}

let resultFixture: unknown = COMPLETE_RESULT
let anchorList: {
  roleId: string
  title: string
  expectedLevel: number
  status: string
}[] = []
onQuery((ref) => {
  if (ref === "assessment.results.getRoleResult") return resultFixture
  if (ref === "assessment.anchorRoles.listAnchorRoles") return anchorList
  return undefined
})

function renderResult(orgId = "org-1", roleId = "role-1") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RatingResult orgId={orgId} roleId={roleId} />
    </NextIntlClientProvider>
  )
}

describe("RatingResult", () => {
  beforeEach(() => {
    resultFixture = COMPLETE_RESULT
    anchorList = []
  })
  afterEach(() => {
    cleanup()
  })

  it("shows a spinner while the result is still loading (undefined)", () => {
    resultFixture = undefined
    renderResult()
    expect(screen.getByLabelText(labels.computing)).toBeDefined()
  })

  it("shows a spinner when the result exists but is not yet complete", () => {
    resultFixture = { ...COMPLETE_RESULT, complete: false, locked: false }
    renderResult()
    expect(screen.getByLabelText(labels.computing)).toBeDefined()
  })

  it("shows a spinner when the result is complete but not yet locked (lock-as-reveal)", () => {
    resultFixture = { ...COMPLETE_RESULT, locked: false }
    renderResult()
    expect(screen.getByLabelText(labels.computing)).toBeDefined()
  })

  it("shows the not-ready state, never a stale score, when a later criterion made a locked role incomplete", () => {
    // Locked stays true once set (locking.ts), but a criterion added after
    // the lock can leave the role incomplete again: the wire then reads
    // complete=false, score=null, level=null even though locked=true
    // (results.ts). The reveal must not print "0 / 100" for that.
    resultFixture = {
      ...COMPLETE_RESULT,
      complete: false,
      score: null,
      level: null,
    }
    renderResult()
    expect(
      screen.queryByText(labels.scoreOutOf.replace("{score}", "0"))
    ).toBeNull()
    // Nothing is in flight, so it is a message and not a spinner: the reader
    // is told what happened and what clears it.
    expect(screen.queryByLabelText(labels.computing)).toBeNull()
    expect(
      screen.getByText(messages.dashboard.roles.detail.lockedIncomplete)
    ).toBeDefined()
  })

  it("shows the score and level badge when complete", () => {
    renderResult()

    // Score (with its fixed 0-100 scale) and level visible.
    expect(
      screen.getByText(labels.scoreOutOf.replace("{score}", "74"))
    ).toBeDefined()
    expect(screen.getByText("2")).toBeDefined()
  })

  it("names the reveal as locked, uncalibrated and on the current method", () => {
    renderResult()
    const detail = messages.dashboard.roles.detail
    expect(screen.getByText(detail.lockedBadge)).toBeDefined()
    expect(screen.queryByText(detail.calibratedBadge)).toBeNull()
    expect(screen.queryByText(detail.methodDriftBadge)).toBeNull()
  })

  it("carries the stale-method chip into the reveal when the lock predates the approval", () => {
    resultFixture = { ...COMPLETE_RESULT, methodDrift: true }
    renderResult()
    expect(
      screen.getByText(messages.dashboard.roles.detail.methodDriftBadge)
    ).toBeDefined()
  })

  it("carries the calibrated chip into the reveal for a confirmed placement", () => {
    resultFixture = { ...COMPLETE_RESULT, calibrated: true }
    renderResult()
    expect(
      screen.getByText(messages.dashboard.roles.detail.calibratedBadge)
    ).toBeDefined()
  })

  it("hides the anchor comparison when there are no active anchors", () => {
    anchorList = [
      {
        roleId: "a-1",
        title: "Retired",
        expectedLevel: 2,
        status: "replaced",
      },
    ]
    renderResult()
    expect(screen.queryByText(labels.anchorsHeading)).toBeNull()
  })

  it("compares against active anchors without a hint when one is near", () => {
    // Result level 2, anchor level 2: distance 0, no manual-validation hint.
    anchorList = [
      {
        roleId: "a-1",
        title: "Team Lead",
        expectedLevel: 2,
        status: "active",
      },
    ]
    renderResult()
    expect(screen.getByText(labels.anchorsHeading)).toBeDefined()
    expect(screen.getByText("Team Lead")).toBeDefined()
    expect(screen.queryByText(labels.farFromAnchors)).toBeNull()
  })

  it("asks for manual validation when every anchor is two or more levels away", () => {
    // Result level 2, nearest anchor level 5: distance 3 (the guide's
    // far-from-anchors flag).
    anchorList = [
      { roleId: "a-1", title: "Director", expectedLevel: 5, status: "active" },
    ]
    renderResult()
    expect(screen.getByText(labels.farFromAnchors)).toBeDefined()
  })
})
