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
import { Profiler, Suspense } from "react"
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
import { ConvexError } from "convex/values"
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
    completed: false,
    readyToComplete: false,
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
const completeAssessmentMock = mockMutation(
  "assessment.completion.completeAssessment"
)
const reopenAssessmentMock = mockMutation(
  "assessment.completion.reopenAssessment"
)

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

describe("RatePage (completion is the reveal)", () => {
  beforeEach(() => {
    roleFixture = role()
    resultFixture = result()
    modelFixture = MODEL
    install()
    setRatingMock.mockReset().mockResolvedValue(null)
    completeAssessmentMock.mockReset().mockResolvedValue(null)
    reopenAssessmentMock.mockReset().mockResolvedValue(null)
  })
  afterEach(() => cleanup())

  it("shows the blind stepper while the assessment is a draft", async () => {
    await renderPage()
    expect(screen.getByText("Scope")).toBeDefined()
    expect(
      screen.getByText("How wide does this role's impact reach?")
    ).toBeDefined()
    // Blind: the draft state renders no result, whatever step it is on. (The
    // fixture has one criterion, so its first step is also its last and DOES
    // carry the completion act; the invariant worth pinning here is that
    // rating shows nothing, not that the ending is out of reach.)
    expect(screen.queryByText(t.result.scoreLabel)).toBeNull()
    expect(screen.queryByText(t.result.levelLabel)).toBeNull()
  })

  // The role's name is a HEADING on the flow, not only a crumb: an assessor
  // mid-stepper reads the surface, and which role is being rated is the one
  // identity the flow may never lose. Asserted by role, because the crumb
  // renders the same words as a link and must not satisfy this.
  it("names the role as a heading, while rating and on the reveal", async () => {
    await renderPage()
    expect(screen.getByRole("heading", { name: "Engineer" })).toBeDefined()

    cleanup()
    resultFixture = result({
      complete: true,
      completed: true,
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
    expect(screen.getByRole("heading", { name: "Engineer" })).toBeDefined()
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

  // The zones are the RESULT side of the wall, and the wall has three
  // different heights that this file must not blur together:
  //
  //  - the WEIGHTING is kept off the wire entirely (the sibling test above):
  //    an assessor who could read how much each criterion counts is no longer
  //    rating against the anchors.
  //  - the score and the level ARE revealed, but only once the assessment is
  //    completed. That is the whole completion-is-the-reveal design, not a
  //    leak.
  //  - the ZONE is on the wire whenever the result is (the firewall protects
  //    the assessment ACT, which completing ends), and never RENDERS here.
  //    Where
  //    the role lands as a KIND OF WORK is a judgement the assessor must not
  //    be anchored by, before completing or after it, and the reveal has no
  //    reason to name it: the level is the answer, the zone is the model's
  //    grouping of levels and belongs on the surfaces that show all twelve.
  //
  // So this asserts a RENDER claim, across every state the route has, against
  // the real content in every locale the app ships rather than a word list
  // someone has to remember to extend. The fixture the reveal runs on carries
  // a real zone for the same reason: on the old `zone: null` fixture no
  // data-driven render of a zone could have failed this test.
  it("shows no zone anywhere on the assessor's route, in any state", async () => {
    const answered = [
      {
        criterionId: "c-scope",
        name: "Scope",
        weightPoints: 3,
        value: 3,
        motivation: null,
      },
    ]
    const states: {
      state: string
      result: Record<string, unknown>
      role?: Record<string, unknown>
    }[] = [
      { state: "draft", result: {} },
      {
        state: "rated, awaiting completion",
        result: { complete: true, ratedCount: 1 },
        role: {
          ratedCount: 1,
          ratings: [{ criterionId: "c-scope", value: 3, motivation: null }],
        },
      },
      {
        state: "completed reveal",
        result: {
          complete: true,
          completed: true,
          ratedCount: 1,
          score: 74,
          level: 2,
          zone: "A",
          criteria: answered,
        },
        role: {
          ratedCount: 1,
          ratings: [{ criterionId: "c-scope", value: 3, motivation: null }],
        },
      },
      {
        state: "completed reveal, profile-limited",
        result: {
          complete: true,
          completed: true,
          ratedCount: 1,
          score: 74,
          level: 4,
          zone: "B",
          profileLimited: true,
          profileFailures: [
            { criterionId: "c-scope", name: "Scope", value: 3, required: 4 },
          ],
          criteria: answered,
        },
        role: {
          ratedCount: 1,
          ratings: [{ criterionId: "c-scope", value: 3, motivation: null }],
        },
      },
    ]

    for (const fixture of states) {
      resultFixture = result(fixture.result)
      roleFixture = role(fixture.role ?? {})
      install()
      const { container } = await renderPage()
      const rendered = container.textContent ?? ""
      for (const locale of ["en", "sv", "nb", "da", "fi"]) {
        const content = zoneContent(locale)
        for (const zone of ZONE_KEYS) {
          const where = `${fixture.state} / ${locale} / ${zone}`
          expect(rendered, where).not.toContain(content.zones[zone].name)
          expect(rendered, where).not.toContain(content.zones[zone].character)
          expect(rendered, where).not.toContain(
            content.zones[zone].typicalProfile
          )
          expect(rendered, where).not.toContain(content.zones[zone].summary)
        }
      }
      // And the band chrome that would name one.
      expect(rendered, fixture.state).not.toMatch(/\bZone [A-D]\b/)
      cleanup()
    }
  })

  // Decision 14: completing IS the flow's ending. One press on the last step
  // saves the rating and completes the assessment; there is no screen in
  // between, which is what the old pin asserted (it required a second click on
  // a second surface to reach the same mutation).
  it("completes the assessment from the last step itself, in one gesture", async () => {
    await renderPage()
    // The ending says what it will do, on the step that does it.
    expect(screen.getByText(t.completeExplanation)).toBeDefined()
    fireEvent.click(screen.getByText("Scope anchor 3"))
    fireEvent.click(screen.getByRole("button", { name: t.completeCta }))
    await waitFor(() => {
      expect(setRatingMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        criterionId: "c-scope",
        value: 3,
      })
    })
    // The same gesture, no second surface in between.
    await waitFor(() => {
      expect(completeAssessmentMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
      })
    })
    // Still blind while it was pressed: the reveal belongs to the branch that
    // takes over once the result turns readable, never to this screen.
    expect(screen.queryByText(t.result.scoreLabel)).toBeNull()
  })

  // The completion's own failures are another operator's edits landing between
  // render and press, and each has words of its own. They are said on the step
  // rather than swallowed into the rating's "could not save".
  it("says why a refused completion was refused, on the step itself", async () => {
    completeAssessmentMock
      .mockReset()
      .mockRejectedValue(new ConvexError({ code: "errors.modelNotApproved" }))
    await renderPage()
    fireEvent.click(screen.getByText("Scope anchor 3"))
    fireEvent.click(screen.getByRole("button", { name: t.completeCta }))
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        messages.errors.modelNotApproved
      )
    })
  })

  it("states the precondition and reveals the result with a one-press reopen for an already-completed role", async () => {
    resultFixture = result({
      complete: true,
      completed: true,
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

    expect(screen.getByText(t.alreadyCompletedExplanation)).toBeDefined()
    expect(
      screen.getByText(t.result.scoreOutOf.replace("{score}", "74"))
    ).toBeDefined()
    // No stepper: a completed assessment cannot be rated.
    expect(screen.queryByText("Scope anchor 3")).toBeNull()

    // One press, no confirm ceremony (decision 14): the trail is the record,
    // and what it costs the reader is in the sentence above the result.
    fireEvent.click(screen.getByRole("button", { name: t.reopenCta }))
    await waitFor(() => {
      expect(reopenAssessmentMock).toHaveBeenCalledWith({
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
    it("uses the same column in the completed reveal state", async () => {
      resultFixture = result({ completed: true })
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

  // THE STAGE LABEL IS GONE, in every state this route has.
  //
  // It named the stage above the title ("Role assessment") on the reasoning
  // that a reader should know which half of the method they are in. The to-do
  // guidance and the surfaces' own identities carry that now, so the label was
  // signage for a road the reader is already being walked down (owner ruling
  // 2026-08-25).
  //
  // Pinned as an absence rather than deleted quietly: deviation 10's OTHER
  // half is the link isolation below, which is the firewall's real mechanism,
  // and a future reader tidying that up should not reach for the eyebrow again
  // on the theory that the two belong together.
  it("names no stage above the title, in any state", async () => {
    const states = [
      () => {},
      () => {
        resultFixture = result({ complete: true, ratedCount: 1 })
        roleFixture = role({
          ratedCount: 1,
          ratings: [{ criterionId: "c-scope", value: 3, motivation: null }],
        })
      },
      () => {
        resultFixture = result({
          complete: true,
          completed: true,
          ratedCount: 1,
          score: 74,
          level: 2,
          criteria: [],
        })
      },
    ]
    for (const setUp of states) {
      setUp()
      install()
      await renderPage()
      expect(document.querySelector('[data-slot="stage-eyebrow"]')).toBeNull()
      cleanup()
    }
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
        completed: true,
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

// THE ROUTE SETTLES, in every state it has.
//
// A route that renders forever is the one defect a screenshot cannot show and
// a passing assertion cannot catch: the tree is correct, and the browser is on
// fire. So the pin is on RENDER COUNT, and specifically on its GROWTH after
// the data has arrived, because a busy loop never stops while a healthy route
// simply stops.
//
// Written after a reported peg on this route turned out to be a wedged dev
// server and a backgrounded tab, not a loop. It is here because that report
// could not be answered by any existing test: nothing pinned that this route
// stops rendering, so the only way to tell a real loop from an artifact was
// the browser, which is exactly the instrument that was lying.
//
// The loading-to-loaded TRANSITION is the part that matters. A harness that
// hands the page its data on the first render never exercises the moment the
// queries resolve, which is where a dependency loop would start.
describe("RatePage settles", () => {
  // Generous: a healthy mount plus the data arriving costs a handful.
  const RENDER_CAP = 60

  const CRITERIA = [CRITERION]
  const RATED = CRITERIA.map((criterion) => ({
    criterionId: criterion.criterionId,
    value: 3,
    motivation: "because",
  }))

  // Queries answer undefined until `ready`, so every case renders its loading
  // branch first and then takes the data, exactly as the real client does.
  let ready = false

  function installGated() {
    onQuery((ref) => {
      if (!ready) return undefined
      if (ref === "assessment.roles.getRoleBySlug") return roleFixture
      if (ref === "evaluationModel.model.getRatingModel") return modelFixture
      if (ref === "assessment.results.getRoleResult") return resultFixture
      if (ref === "assessment.anchorRoles.listAnchorRoles") return []
      return undefined
    })
  }

  async function settleCount() {
    let renders = 0
    // A FRESH element per render, never the same one twice: React bails out of
    // a re-render whose element is referentially identical, which leaves the
    // page in its loading branch and the assertions with nothing to find.
    const tree = () => (
      <Profiler
        id="rate"
        onRender={() => {
          renders += 1
          // A CAP, so a real loop fails this test instead of hanging the
          // suite. Without it an unbounded re-render spins inside act() and
          // the run never returns, which reports as a timeout with no name
          // on it: the least useful shape a failure can take.
          if (renders > RENDER_CAP) {
            throw new Error(
              `RatePage re-rendered more than ${RENDER_CAP} times: render loop`
            )
          }
        }}
      >
        {page()}
      </Profiler>
    )
    let rendered: ReturnType<typeof render> | undefined
    await act(async () => {
      rendered = render(tree())
    })
    ready = true
    await act(async () => {
      rendered?.rerender(tree())
      await new Promise((resolve) => setTimeout(resolve, 100))
    })
    const afterData = renders
    // A second window with nothing left to do: a loop keeps counting here.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200))
    })
    return { afterData, growth: renders - afterData }
  }

  beforeEach(() => {
    ready = false
    roleFixture = role()
    resultFixture = result()
    modelFixture = MODEL
    installGated()
  })
  afterEach(() => {
    cleanup()
    ready = false
  })

  it("settles on a draft with nothing rated yet", async () => {
    const { growth } = await settleCount()
    expect(growth).toBe(0)
    expect(screen.getByText("Scope")).toBeDefined()
  })

  it("settles on a partial draft", async () => {
    roleFixture = role({ ratings: RATED, ratedCount: 1 })
    resultFixture = result({ ratedCount: 1 })
    const { growth } = await settleCount()
    expect(growth).toBe(0)
  })

  // THE OWNER'S STATE: every criterion answered, the assessment still open.
  // The stepper resumes on the last step, one press from its own ending, so
  // this is the case where the completion control has to be on screen.
  it("settles with everything rated and the assessment still open, on the completing step", async () => {
    roleFixture = role({ ratings: RATED, ratedCount: 1 })
    resultFixture = result({
      complete: true,
      ratedCount: 1,
      readyToComplete: true,
    })
    const { growth } = await settleCount()
    expect(growth).toBe(0)
    expect(
      screen.getByRole("button", { name: new RegExp(t.completeCta) })
    ).toBeDefined()
  })

  it("settles on the completed reveal", async () => {
    roleFixture = role({ ratings: RATED, ratedCount: 1 })
    resultFixture = result({
      complete: true,
      completed: true,
      ratedCount: 1,
      score: 70,
      level: 4,
    })
    const { growth } = await settleCount()
    expect(growth).toBe(0)
    expect(screen.getByText(t.alreadyCompletedExplanation)).toBeDefined()
  })

  // Reopened: completed once, now open again with every rating still stored.
  // Indistinguishable from the owner's state on the wire, and that is the
  // point: it must resume the same way rather than walk the ladder again.
  it("settles after a reopen", async () => {
    roleFixture = role({ ratings: RATED, ratedCount: 1 })
    resultFixture = result({ complete: true, completed: false, ratedCount: 1 })
    const { growth } = await settleCount()
    expect(growth).toBe(0)
    expect(
      screen.getByRole("button", { name: new RegExp(t.completeCta) })
    ).toBeDefined()
  })
})
