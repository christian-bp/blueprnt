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
import { ZONE_KEYS } from "@workspace/core"
import { zoneContent } from "@workspace/backend/convex/evaluationModel/zoneContent"
import { RATE_COLUMN } from "@/lib/rate-column"

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
    readyToRead: false,
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

  // The zones are the RESULT side of the wall. An assessor rates a role
  // against its anchors; where the role would land is the thing the whole
  // blind-rating design exists to keep out of that judgement, so no zone name,
  // no zone letter and no zone description may reach this route in any of its
  // states. Asserted against the real content, in every locale the app ships,
  // rather than against a word list someone has to remember to extend.
  it("shows no zone anywhere on the assessor's route", async () => {
    const { container } = await renderPage()
    const rendered = container.textContent ?? ""
    for (const locale of ["en", "sv", "nb", "da", "fi"]) {
      const content = zoneContent(locale)
      for (const zone of ZONE_KEYS) {
        expect(rendered).not.toContain(content.zones[zone].name)
        expect(rendered).not.toContain(content.zones[zone].character)
        expect(rendered).not.toContain(content.zones[zone].summary)
      }
    }
    // And the band chrome that would name one.
    expect(rendered).not.toMatch(/\bZone [A-D]\b/)
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
      expect(screen.getByText(t.readyToReadExplanation)).toBeDefined()
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

  // Deviation 10: the assessment route names its stage rather than blocking
  // navigation, and it names it in EVERY state, including the two where an
  // assessor is deepest in the work.
  // The route's reading column is ONE container holding the breadcrumb row and
  // the content, never two siblings each deciding its own width. It was two:
  // the outer wrapper spanned the content region while the card inside carried
  // max-w-2xl with no mx-auto, so the header ran the full region and the card
  // sat pinned to its left edge with a dead margin beside it.
  //
  // Pinned STRUCTURALLY rather than by measurement: jsdom lays nothing out, so
  // what a test can guarantee is that the header and the content cannot have
  // separate centring axes, which is true exactly when they share one
  // container and nothing under it re-caps the width.
  describe("the route's reading column", () => {
    const trail = () =>
      document.querySelector(
        '[data-slot="page-breadcrumb-row"]'
      ) as HTMLElement | null

    it("holds the breadcrumb and the content in one centred container", async () => {
      await renderPage()
      const column = trail()?.parentElement
      expect(column).not.toBeNull()
      for (const token of RATE_COLUMN.split(/\s+/)) {
        expect(column?.className.split(/\s+/)).toContain(token)
      }
      // The content is a SIBLING of the trail inside that container, not a
      // cousin in a wrapper of its own.
      expect(column?.childElementCount).toBeGreaterThan(1)
    })

    it("re-caps the width nowhere below the column", async () => {
      await renderPage()
      const column = trail()?.parentElement
      expect(column).not.toBeNull()
      // A second cap under the column would put the content back on an axis of
      // its own, which is the shape this route just came off.
      const capped = [...(column?.querySelectorAll("[class]") ?? [])].filter(
        (node) =>
          /(^|\s)max-w-(sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)(\s|$)/.test(
            node.className.toString()
          )
      )
      expect(capped.map((node) => node.className.toString())).toEqual([])
    })

    // Every state of the route, so the column cannot shift as the page moves
    // between loading, a precondition, the stepper and the reveal.
    it("uses the same column in the locked reveal state", async () => {
      resultFixture = result({ locked: true })
      install()
      await renderPage()
      expect(trail()?.parentElement?.className).toContain("mx-auto")
    })

    it("uses the same column in the precondition state", async () => {
      roleFixture = role({ profileComplete: false })
      install()
      await renderPage()
      expect(trail()?.parentElement?.className).toContain("mx-auto")
    })
  })

  describe("the stage names itself", () => {
    const eyebrow = () =>
      document.querySelector(
        '[data-slot="stage-eyebrow"]'
      ) as HTMLElement | null

    it("labels the stepper, the completion panel and the reveal", async () => {
      // Rating.
      await renderPage()
      expect(eyebrow()?.textContent).toBe(t.stageEyebrow)
      cleanup()

      // Every criterion answered, waiting to lock.
      resultFixture = result({ complete: true, ratedCount: 1 })
      roleFixture = role({
        ratedCount: 1,
        ratings: [{ criterionId: "c-scope", value: 3, motivation: null }],
      })
      install()
      await renderPage()
      expect(eyebrow()?.textContent).toBe(t.stageEyebrow)
      cleanup()

      // Locked: the reveal.
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
      expect(eyebrow()?.textContent).toBe(t.stageEyebrow)
    })

    // A SCANNED label, not a sentence: the reading floor's own eyebrow
    // exception, and the class string this app already uses for its scanned
    // section labels.
    it("reads as a scanned label", async () => {
      await renderPage()
      const tokens = (eyebrow()?.className ?? "").split(/\s+/)
      expect(tokens).toContain("uppercase")
      expect(tokens).toContain("text-xs")
      expect(tokens).toContain("tracking-wide")
    })

    // Scanned in TREATMENT, but not hidden from the accessibility tree. The
    // label was aria-hidden at first, on the reasoning that the surface's own
    // title already says where you are. That reasoning does not survive the
    // other surface this label serves: the model shell has no breadcrumb at
    // all, so hiding it announced the stage to nobody there. One behaviour,
    // announced on both.
    it("is announced, not hidden from assistive technology", async () => {
      await renderPage()
      expect(eyebrow()?.hasAttribute("aria-hidden")).toBe(false)
      expect(
        await screen.findByText(t.stageEyebrow, { ignore: "[aria-hidden]" })
      ).toBeDefined()
    })
  })

  // Deviation 10's other half: an assessor mid-assessment is offered no route
  // into the builder (which carries the weighting they must not see) or into
  // the results surfaces. Enforced as an ABSENCE OF LINKS rather than a hard
  // block, so this walks what the route actually renders.
  describe("the route offers no builder and no results", () => {
    const hrefs = () =>
      [...document.querySelectorAll("a")].map(
        (a) => a.getAttribute("href") ?? ""
      )

    const FORBIDDEN = /^\/model(\/|$)|^\/work(\/|$)/

    it("links to neither from the stepper", async () => {
      await renderPage()
      expect(hrefs().length).toBeGreaterThan(0)
      expect(hrefs().filter((href) => FORBIDDEN.test(href))).toEqual([])
    })

    it("links to neither from the reveal", async () => {
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
      expect(hrefs().length).toBeGreaterThan(0)
      expect(hrefs().filter((href) => FORBIDDEN.test(href))).toEqual([])
    })

    // The trail is where the results surface used to get in: /work is the
    // level matrix, and it was an ancestor crumb on every state of this
    // route.
    it("keeps the level matrix out of its own breadcrumb trail", async () => {
      await renderPage()
      expect(hrefs()).toContain("/roles")
      expect(hrefs()).not.toContain("/work")
    })

    // The ONE exception, pinned rather than allowed silently: a model that is
    // not approved yet is a blocked state with no assessment in it, and its
    // only purpose is to send an admin to the chapter that unblocks it.
    it("makes its one builder link the unapproved-model way out", async () => {
      modelFixture = { ...MODEL, approved: false }
      install()
      await renderPage()
      expect(hrefs().filter((href) => FORBIDDEN.test(href))).toEqual([
        "/model/approval",
      ])
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
