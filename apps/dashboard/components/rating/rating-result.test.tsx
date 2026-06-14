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
  ratedCount: 2,
  totalCriteria: 2,
  score: 74,
  band: 2,
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
  expectedBand: number
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
    resultFixture = { ...COMPLETE_RESULT, complete: false }
    renderResult()
    expect(screen.getByLabelText(labels.computing)).toBeDefined()
  })

  it("shows the score, band badge, and bandHighest note when complete", () => {
    renderResult()

    // Score (with its fixed 0-100 scale) and band visible.
    expect(
      screen.getByText(labels.scoreOutOf.replace("{score}", "74"))
    ).toBeDefined()
    expect(screen.getByText("2")).toBeDefined()

    // Band-1-is-highest explanation.
    expect(screen.getByText(labels.bandHighest)).toBeDefined()
  })

  it("hides the anchor comparison when there are no active anchors", () => {
    anchorList = [
      { roleId: "a-1", title: "Retired", expectedBand: 2, status: "replaced" },
    ]
    renderResult()
    expect(screen.queryByText(labels.anchorsHeading)).toBeNull()
  })

  it("compares against active anchors without a hint when one is near", () => {
    // Result band 2, anchor band 2: distance 0, no manual-validation hint.
    anchorList = [
      { roleId: "a-1", title: "Team Lead", expectedBand: 2, status: "active" },
    ]
    renderResult()
    expect(screen.getByText(labels.anchorsHeading)).toBeDefined()
    expect(screen.getByText("Team Lead")).toBeDefined()
    expect(screen.queryByText(labels.farFromAnchors)).toBeNull()
  })

  it("asks for manual validation when every anchor is two or more bands away", () => {
    // Result band 2, nearest anchor band 5: distance 3 (the guide's
    // far-from-anchors flag).
    anchorList = [
      { roleId: "a-1", title: "Director", expectedBand: 5, status: "active" },
    ]
    renderResult()
    expect(screen.getByText(labels.farFromAnchors)).toBeDefined()
  })
})
