import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { Suspense } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mockMutation, onQuery } from "@/test/convex-mocks"

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
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import RatePage from "@/app/(app)/roles/[roleSlug]/rate/page"
import { chapterHref } from "@/lib/model-chapters"

const t = messages.dashboard.rating
const tDetail = messages.dashboard.roles.detail

const CRITERION = {
  criterionId: "c-scope",
  name: "Scope",
  assessmentQuestion: "How wide does this role's impact reach?",
  measures: "The role's reach.",
  notMeasures: "Nothing else.",
  dimensionKey: "responsibility",
  anchors: [1, 2, 3, 4, 5].map((step) => ({
    step,
    text: `Scope anchor ${step}`,
  })),
}

const MODEL = {
  approved: true,
  criteria: [CRITERION],
  midpoints: {
    step2: "A considered midpoint.",
    step4: "A considered midpoint.",
  },
}

function role(overrides: Record<string, unknown> = {}) {
  return {
    roleId: "role-1",
    title: "Engineer",
    slug: "engineer",
    function: "Engineering",
    team: "Core",
    trackKey: "IC",
    trackName: "Individual contributor",
    purpose: "Builds things.",
    responsibilities: "Ships features.",
    archived: false,
    profileComplete: true,
    ratedCount: 0,
    totalCriteria: 1,
    familyId: null,
    familyName: null,
    familySlug: null,
    anchorRole: null,
    ratings: [],
    ...overrides,
  }
}

function result(overrides: Record<string, unknown> = {}) {
  return {
    roleId: "role-1",
    title: "Engineer",
    complete: false,
    locked: false,
    readyToLock: false,
    calibrated: false,
    methodDrift: false,
    ratedCount: 0,
    totalCriteria: 1,
    score: null,
    level: null,
    zone: null,
    profileLimited: null,
    profileFailures: null,
    criteria: [],
    ...overrides,
  }
}

let roleFixture: unknown = role()
let resultFixture: unknown = result()
let modelFixture: unknown = MODEL

// Every query ref this page actually asks for, so a test can assert what it
// does NOT ask for.
let requestedRefs: string[] = []

function install() {
  requestedRefs = []
  onQuery((ref) => {
    requestedRefs.push(ref)
    if (ref === "assessment.roles.getRoleBySlug") return roleFixture
    if (ref === "evaluationModel.model.getRatingModel") return modelFixture
    if (ref === "assessment.results.getRoleResult") return resultFixture
    if (ref === "assessment.anchorRoles.listAnchorRoles") return []
    return undefined
  })
}

const setRatingMock = mockMutation("assessment.ratings.setRating")
const lockAssessmentMock = mockMutation("assessment.locking.lockAssessment")
const unlockAssessmentMock = mockMutation("assessment.locking.unlockAssessment")

const PARAMS = Promise.resolve({ roleSlug: "engineer" })

function page() {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <Suspense fallback={null}>
        <RatePage params={PARAMS} />
      </Suspense>
    </NextIntlClientProvider>
  )
}

async function renderPage() {
  // use(params) suspends the first mount, so the act scope has to cover the
  // render itself for the resolution to be flushed before the assertions.
  let rendered: ReturnType<typeof render> | undefined
  await act(async () => {
    rendered = render(page())
  })
  if (rendered === undefined) throw new Error("render did not run")
  return rendered
}

describe("RatePage (lock-as-reveal)", () => {
  beforeEach(() => {
    roleFixture = role()
    resultFixture = result()
    modelFixture = MODEL
    install()
    setRatingMock.mockReset().mockResolvedValue(null)
    lockAssessmentMock.mockReset().mockResolvedValue(null)
    unlockAssessmentMock.mockReset().mockResolvedValue(null)
  })
  afterEach(() => cleanup())

  it("shows the blind stepper while the assessment is a draft", async () => {
    await renderPage()
    expect(screen.getByText("Scope")).toBeDefined()
    expect(
      screen.getByText("How wide does this role's impact reach?")
    ).toBeDefined()
    // No reveal, no lock action yet.
    expect(screen.queryByText(t.lockCta)).toBeNull()
  })

  // The firewall, at the wire rather than at the render: an assessor rates
  // against the anchors and must not know how much each criterion counts, so
  // the weighting is not in this client at all. Asserted as "this page never
  // asks for the model wire", because a page that asked for it would have the
  // weights one devtools panel away however carefully it rendered them.
  it("never asks for the model wire that carries the weighting", async () => {
    await renderPage()
    expect(requestedRefs).toContain("evaluationModel.model.getRatingModel")
    expect(requestedRefs).not.toContain("evaluationModel.model.getModel")
  })

  it("offers Lock assessment once the last criterion is answered, without revealing anything", async () => {
    await renderPage()
    fireEvent.click(screen.getByText("Scope anchor 3"))
    fireEvent.click(screen.getByRole("button", { name: t.finishCta }))
    await waitFor(() => {
      expect(setRatingMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        criterionId: "c-scope",
        value: 3,
      })
    })
    await waitFor(() => {
      expect(screen.getByText(t.readyToLockExplanation)).toBeDefined()
    })
    expect(screen.getByRole("button", { name: t.lockCta })).toBeDefined()
    // Still blind: no score/level anywhere on this screen.
    expect(screen.queryByText(t.result.scoreLabel)).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: t.lockCta }))
    await waitFor(() => {
      expect(lockAssessmentMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
      })
    })
  })

  it("states the precondition and reveals the result with an unlock affordance for an already-locked role", async () => {
    resultFixture = result({
      complete: true,
      locked: true,
      ratedCount: 1,
      score: 74,
      level: 2,
      criteria: [
        {
          criterionId: "c-scope",
          name: "Scope",
          weightPoints: 3,
          value: 3,
          motivation: null,
        },
      ],
    })
    install()
    await renderPage()

    expect(screen.getByText(t.alreadyLockedExplanation)).toBeDefined()
    expect(
      screen.getByText(t.result.scoreOutOf.replace("{score}", "74"))
    ).toBeDefined()
    // No stepper: the assessment cannot be rated while locked.
    expect(screen.queryByText("Scope anchor 3")).toBeNull()

    const unlockCta = screen.getByRole("button", { name: t.unlockCta })
    fireEvent.click(unlockCta)
    expect(screen.getByText(t.unlockDialogTitle)).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: t.unlockConfirm }))
    await waitFor(() => {
      expect(unlockAssessmentMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
      })
    })
  })

  it("states the precondition in words when the role is archived, without the stepper", async () => {
    roleFixture = role({ archived: true })
    install()
    await renderPage()
    expect(screen.getByText(t.lockedExplanation)).toBeDefined()
    expect(screen.queryByText("Scope")).toBeNull()
  })

  it("states the precondition in words when the job profile is incomplete", async () => {
    roleFixture = role({ profileComplete: false })
    install()
    await renderPage()
    expect(screen.getByText(tDetail.profileIncomplete)).toBeDefined()
  })

  // The unblock link has to land on the chapter where the approve control
  // actually is. It pointed at the method page after approval moved to its own
  // chapter, which sent every blocked rater to a page with no way forward.
  it("sends an unapproved model to the chapter that can approve it", async () => {
    modelFixture = { ...MODEL, approved: false }
    install()
    await renderPage()
    expect(screen.getByText(t.modelUnapprovedExplanation)).toBeDefined()
    const link = screen.getByRole("link", { name: t.modelUnapprovedCta })
    expect(link.getAttribute("href")).toBe(chapterHref("approval"))
    expect(link.getAttribute("href")).toBe("/model/approval")
    // The stepper is not offered at all: the precondition is stated instead.
    expect(screen.queryByText("Scope")).toBeNull()
  })
})
