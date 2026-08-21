import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
let orgRole = "admin"
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: orgRole }),
}))
// NumberFlow renders a custom element happy-dom never upgrades, so its
// getSnapshotBeforeUpdate throws the moment the value CHANGES in place, which
// is exactly what a weight click does to the budget readout. The digit
// animation is the library's business; these tests are about the figures.
vi.mock("@number-flow/react", () => ({
  // Format-aware on purpose: the figures this surface rolls are percentages,
  // so a mock that ignored `format` would let a wrong Intl option pass.
  default: ({
    value,
    format,
  }: {
    value: number
    format?: Intl.NumberFormatOptions
  }) => (
    <span>
      {format === undefined
        ? value
        : new Intl.NumberFormat("en", format).format(value)}
    </span>
  ),
}))

import { CHAPTER_GRID_CLASS } from "@/components/model/chapter-grid"
import { WeightingChapter } from "@/components/model/weighting-chapter"
import { mockMutation, onQuery } from "@/test/convex-mocks"

const weighting = messages.dashboard.model.weighting
const editor = messages.dashboard.model.editor

const rebalanceWeights = mockMutation(
  "evaluationModel.criteria.rebalanceWeights"
)
const setMotivation = mockMutation(
  "evaluationModel.criteria.setCriterionWeightMotivation"
)

const DIMENSIONS = [
  { key: "competence", name: "Competence", question: "q1", why: "w1" },
  { key: "effort", name: "Effort and complexity", question: "q2", why: "w2" },
  {
    key: "responsibility",
    name: "Responsibility and impact",
    question: "q3",
    why: "w3",
  },
  {
    key: "workingConditions",
    name: "Working conditions",
    question: "q4",
    why: "w4",
  },
]

const COMPLEXITY = "Complexity and ambiguity"
const KNOWLEDGE_DEPTH = "Knowledge depth and specialist level"
const ANCHOR_LOW = "Follows an established method"

function criterion(overrides: Record<string, unknown>) {
  return {
    weightMotivation: null as string | null,
    criterionId: "c",
    libraryKey: "complexity-ambiguity",
    dimensionKey: "effort",
    name: "Criterion",
    shortUiText: "",
    fullDefinition: "",
    measures: "",
    notMeasures: "",
    assessmentQuestion: "",
    anchors: [] as { step: number; text: string }[],
    weightPoints: 3,
    order: 1,
    ...overrides,
  }
}

function makeModel(
  entries: ReturnType<typeof criterion>[],
  // The recorded materiality decision, as getModel carries it: what the fourth
  // column says when it holds nothing.
  workingConditions: {
    status: "active" | "testedNotMaterial"
    motivation: string
    decidedBy: string
    decidedAt: number
  } | null = null
) {
  return {
    modelId: "model-1",
    name: "Standard",
    approval: null,
    workingConditions,
    criteria: entries,
    sharedScale: [],
    midpoints: { step2: "", step4: "" },
    dimensions: DIMENSIONS,
    tracks: [],
    levelRules: [{ level: 1, minScore: 100 }],
    zoneProfileRules: [],
  }
}

// Five criteria summing to the budget (5 x 3 = 15).
const BALANCED = makeModel([
  criterion({
    criterionId: "c1",
    libraryKey: "complexity-ambiguity",
    dimensionKey: "effort",
    name: COMPLEXITY,
    weightPoints: 4,
    order: 1,
    anchors: [{ step: 1, text: ANCHOR_LOW }],
  }),
  criterion({
    criterionId: "c2",
    libraryKey: "autonomy-mandate",
    dimensionKey: "responsibility",
    name: "Autonomy and decision mandate",
    weightPoints: 2,
    order: 2,
  }),
  criterion({
    criterionId: "c3",
    libraryKey: "scope-impact",
    dimensionKey: "responsibility",
    name: "Scope and impact",
    weightPoints: 3,
    order: 3,
  }),
  criterion({
    criterionId: "c4",
    libraryKey: "knowledge-depth",
    dimensionKey: "competence",
    name: KNOWLEDGE_DEPTH,
    weightPoints: 3,
    order: 4,
  }),
  criterion({
    criterionId: "c5",
    libraryKey: "risk-consequence",
    dimensionKey: "responsibility",
    name: "Risk and consequence",
    weightPoints: 3,
    order: 5,
  }),
])

let modelResult: unknown = BALANCED
// The engine's answer about the weighting, as getMethodChecks returns it: the
// per-dimension shares (fractions) and which dimensions the
// dimensionWeightBalance check names as dominant-and-unmotivated.
let methodChecksResult: unknown = null

// BALANCED is 4+2+3+3+3 = 15: responsibility 8/15, effort 4/15, competence
// 3/15. The engine computes these; the fixture states them once so a test never
// spells a fraction out inline.
function checksFor(unmotivated: string[], leadershipOk = true) {
  return {
    checks: [
      {
        key: "dimensionWeightBalance",
        level: "warning",
        ok: unmotivated.length === 0,
        ...(unmotivated.length > 0 ? { dimensions: unmotivated } : {}),
      },
      { key: "peopleLeadershipWeight", level: "warning", ok: leadershipOk },
    ],
    approval: null,
    lastApprovedAt: null,
    workingConditions: null,
    dimensionShares: [
      { key: "competence", share: 3 / 15 },
      { key: "effort", share: 4 / 15 },
      { key: "responsibility", share: 8 / 15 },
      { key: "workingConditions", share: 0 },
    ],
  }
}

function renderChapter() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WeightingChapter orgId="org-1" />
    </NextIntlClientProvider>
  )
}

const groupFor = (name: string) =>
  screen.getByRole("group", {
    name: weighting.setWeightPoints.replace("{name}", name),
  })
const save = () => screen.getByRole("button", { name: weighting.saveCta })

// The fourth dimension's column, which is drawn whether or not it holds a
// criterion.
const workingConditionsColumn = () =>
  screen
    .getByRole("heading", { name: /Working conditions/ })
    .closest("section") as HTMLElement

describe("the Viktning chapter", () => {
  beforeEach(() => {
    rebalanceWeights.mockReset()
    rebalanceWeights.mockResolvedValue(null)
    setMotivation.mockReset()
    setMotivation.mockResolvedValue(null)
    orgRole = "admin"
    modelResult = BALANCED
    methodChecksResult = checksFor(["responsibility"])
    onQuery((ref) => {
      if (ref === "evaluationModel.model.getModel") return modelResult
      if (ref === "evaluationModel.approval.getMethodChecks") {
        return methodChecksResult
      }
      if (ref === "ai.suggest.getWeightReviewLock") return false
      if (ref === "ai.suggest.getOpenSuggestions") return []
      return undefined
    })
  })
  afterEach(() => cleanup())

  // The chosen criteria stay in their dimension's column, so a criterion is
  // where the reader last saw it; only the weight row is new here.
  it("groups the chosen criteria by dimension, each with its weight row", () => {
    renderChapter()
    const responsibility = screen
      .getByRole("heading", { name: /Responsibility and impact/ })
      .closest("section") as HTMLElement
    expect(within(responsibility).getAllByRole("group")).toHaveLength(3)
    expect(groupFor(COMPLEXITY)).toBeDefined()
    // The fourth column is drawn whatever it holds, but nothing in it is
    // weighted while it holds nothing.
    expect(within(workingConditionsColumn()).queryAllByRole("group")).toEqual(
      []
    )
  })

  // Every chapter draws its dimensions in the one shared frame, so a tweak to
  // the box lands on all three at once.
  it("draws every column in the shared dimension frame", () => {
    const { container } = renderChapter()
    expect(
      container.querySelectorAll('[data-slot="dimension-frame"]')
    ).toHaveLength(4)
  })

  // Every OTHER dimension keeps the rule: an empty column is a gap on the way
  // to being filled, and a gap draws nothing.
  it("draws no column for an empty dimension that is not working conditions", () => {
    modelResult = makeModel([
      criterion({
        criterionId: "c1",
        libraryKey: "complexity-ambiguity",
        dimensionKey: "effort",
        name: COMPLEXITY,
        weightPoints: 3,
        order: 1,
      }),
    ])
    renderChapter()
    expect(screen.queryByRole("heading", { name: /Competence/ })).toBeNull()
    expect(
      screen.queryByRole("heading", { name: /Responsibility and impact/ })
    ).toBeNull()
    expect(workingConditionsColumn()).toBeDefined()
  })

  // The balance between dimensions is the thing this chapter can get wrong,
  // and it was only visible on the Godkännande checklist after the fact. Each
  // heading now carries its dimension's own share, derived from the LOCAL
  // allocation so it moves with an unsaved edit.
  it("shows each dimension's own share in its heading, live", () => {
    renderChapter()
    const headingFor = (name: string) =>
      screen.getByRole("heading", { name: new RegExp(name) }).textContent
    // BALANCED is 4+2+3+3+3 = 15: responsibility holds 2+3+3 = 8, competence 3,
    // effort 4.
    expect(headingFor("Responsibility and impact")).toBe(
      "Responsibility and impact · 53% of the weight"
    )
    expect(headingFor("Competence")).toBe("Competence · 20% of the weight")
    expect(headingFor("Effort and complexity")).toBe(
      "Effort and complexity · 27% of the weight"
    )

    // An unsaved edit moves it: dropping effort from 4 to 1 rebalances the
    // shares before anything is saved.
    fireEvent.click(
      within(groupFor(COMPLEXITY)).getByRole("button", { name: "1" })
    )
    expect(headingFor("Effort and complexity")).toBe(
      "Effort and complexity · 8% of the weight"
    )
  })

  // The whole reason criteria and weights are separate chapters: the 1-5
  // weighting is never beside the role-facing 1-5 evaluation scale.
  it("never renders the evaluation scale", () => {
    renderChapter()
    expect(screen.getByText(COMPLEXITY)).toBeDefined()
    expect(screen.queryByText(ANCHOR_LOW)).toBeNull()
  })

  it("saves the whole allocation at once, and only when it balances", async () => {
    renderChapter()
    // Nothing edited yet: balanced but clean, so there is nothing to post.
    expect(screen.getByText(weighting.balanced)).toBeDefined()
    expect((save() as HTMLButtonElement).disabled).toBe(true)

    // c1 4 -> 3 alone leaves the budget short: the save stays shut and the bar
    // stops claiming the points are distributed.
    fireEvent.click(
      within(groupFor(COMPLEXITY)).getByRole("button", { name: "3" })
    )
    expect((save() as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText(weighting.balanced)).toBeNull()
    expect(screen.getByText("1 weight point left to distribute")).toBeDefined()

    // Compensating elsewhere balances it, and the save posts every criterion.
    fireEvent.click(
      within(groupFor("Autonomy and decision mandate")).getByRole("button", {
        name: "3",
      })
    )
    expect((save() as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(save())
    await waitFor(() => {
      expect(rebalanceWeights).toHaveBeenCalledWith({
        orgId: "org-1",
        allocations: [
          { criterionId: "c1", weightPoints: 3 },
          { criterionId: "c2", weightPoints: 3 },
          { criterionId: "c3", weightPoints: 3 },
          { criterionId: "c4", weightPoints: 3 },
          { criterionId: "c5", weightPoints: 3 },
        ],
      })
    })
  })

  // Changing WHICH criteria are in the model is the Kriterier chapter's job
  // alone; this chapter only distributes points among them.
  //
  // Queried by the LIVE control's own labels. It named the retired dropdown's
  // rowMenuLabel for a while, which no longer matches anything on any surface,
  // so the test passed whether or not the rule held. The card's prop union is
  // the primary lock (a weight card cannot be given an onRemove); this is the
  // runtime pin, and it discriminates because the same removeLabel query is
  // what the Kriterier chapter's own removal test clicks.
  it("offers no way to remove a criterion", () => {
    renderChapter()
    for (const name of [COMPLEXITY, KNOWLEDGE_DEPTH]) {
      expect(
        screen.queryByRole("button", {
          name: editor.removeLabel.replace("{name}", name),
        })
      ).toBeNull()
    }
    // Nor an armed confirm pill, the only other control the morph ever shows.
    expect(
      screen.queryByRole("button", { name: editor.removeConfirm })
    ).toBeNull()
  })

  // Never a bare page: the chapter has nothing to weight until the previous
  // one has been done, and it says so with the way back.
  it("points at the Kriterier chapter when nothing is chosen yet", () => {
    modelResult = makeModel([])
    renderChapter()
    const link = screen.getByRole("link")
    expect(link.getAttribute("href")).toBe("/model/criteria")
    expect(screen.getByText(weighting.budgetEmpty)).toBeDefined()
  })

  // It opens the chapter rather than sitting at the foot of it: with the
  // criteria on their own chapter this one is short, so its one action belongs
  // where the reader starts.
  it("opens with the budget block, not a sticky footer", () => {
    renderChapter()
    const block = screen.getByRole("status")
    expect(block.className).not.toContain("sticky")
    expect(save().closest("[class*='sticky']")).toBeNull()
    // Everything the chapter asks the reader to do comes after it.
    expect(
      block.compareDocumentPosition(groupFor(COMPLEXITY)) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  // Same as the Kriterier chapter: uncapped width divided by the one exported
  // CHAPTER_GRID_CLASS constant both chapters and both loading states read,
  // so none of the four can ever drift apart.
  it("lays the loading and loaded grids out with the same classes", () => {
    // Selected on the chapter grid's OWN breakpoint class, not on a bare
    // "grid-cols": the status Alert above carries a grid-cols of its own
    // (alertVariants' has-[>svg]:grid-cols-[auto_1fr]) and would be matched
    // first, which made this compare the Alert with itself.
    const gridOf = (root: HTMLElement) =>
      root.querySelector('[class*="sm:grid-cols-2"]')?.className
    const { container: loaded } = renderChapter()
    const loadedGrid = gridOf(loaded)
    expect(loadedGrid).toBe(CHAPTER_GRID_CLASS)
    cleanup()
    modelResult = undefined
    const { container: loading } = renderChapter()
    expect(gridOf(loading)).toBe(loadedGrid)
    // Four across begins at 2xl, not xl: at a 1440-class laptop width four
    // columns compress past what a criterion title can wrap into, and 2x2
    // reads comfortably there. Split into tokens, because "2xl:grid-cols-4"
    // contains "xl:grid-cols-4" as a substring and a contains-check could
    // never tell the two breakpoints apart.
    const gridTokens = (loadedGrid ?? "").split(/\s+/)
    expect(gridTokens).toContain("2xl:grid-cols-4")
    expect(gridTokens).not.toContain("xl:grid-cols-4")
  })

  it("shows the chapter's own skeleton while the model loads", () => {
    modelResult = undefined
    renderChapter()
    // The budget bar is the chapter's chrome, not its data: it renders for
    // real, in the same shell the loaded bar uses, so nothing shifts when the
    // model arrives.
    expect(
      screen.getByText(/weight points allocated/, { exact: false })
    ).toBeDefined()
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.help.weightingLabel,
      })
    ).toBeDefined()
    // The real save button, disabled: the loaded bar opens clean, where it is
    // disabled too.
    expect((save() as HTMLButtonElement).disabled).toBe(true)
    // Nothing is weighted yet, so no weight row exists to be edited.
    expect(screen.queryAllByRole("group")).toHaveLength(0)
  })

  // One column per dimension, because the fourth is now drawn whatever it
  // holds and the common model fills the other three.
  it("stands four columns up while the model loads", () => {
    modelResult = undefined
    const { container } = renderChapter()
    const grid = container.querySelector('[class*="sm:grid-cols-2"]')
    expect(grid?.children).toHaveLength(4)
    // In the same frame the loaded chapter draws them in.
    expect(
      container.querySelectorAll('[data-slot="dimension-frame"]')
    ).toHaveLength(4)
    // Two placeholder cards each, except the fourth: its dimension caps at
    // one, so a second there would promise a criterion the model cannot hold.
    expect(container.querySelectorAll("ul li")).toHaveLength(7)
  })
  // The fourth dimension never vanishes: an empty competence column is a gap
  // on the way to being filled, while an empty working-conditions column can
  // be the finished answer, and only the column itself can say which.
  describe("the working-conditions column", () => {
    const workingConditions =
      messages.dashboard.model.criteria.workingConditions
    const decision = (status: "active" | "testedNotMaterial") => ({
      status,
      motivation: "m",
      decidedBy: "u1",
      decidedAt: 1,
    })
    // The sentence as one paragraph: two of the three carry a link, which
    // splits them across elements, and the default matcher does not join those.
    const lineNode = (key: keyof typeof workingConditions) =>
      within(workingConditionsColumn()).queryByText(
        (_, node) =>
          node?.tagName === "P" &&
          node.textContent === workingConditions[key].replace(/<\/?link>/g, "")
      )
    const hatch = () =>
      within(workingConditionsColumn()).queryByRole("img", {
        name: messages.dashboard.model.criteria.columnEmpty,
      })

    it("stands empty with the materiality test still to take", () => {
      renderChapter()
      expect(lineNode("columnUndecided")).not.toBeNull()
      expect(
        within(workingConditionsColumn())
          .getByRole("link", { name: /Criteria chapter/ })
          .getAttribute("href")
      ).toBe("/model/criteria")
      expect(hatch()).not.toBeNull()
    })

    it("stands empty, judged material, pointing at where its criterion is chosen", () => {
      modelResult = makeModel(BALANCED.criteria, decision("active"))
      renderChapter()
      expect(lineNode("columnMaterial")).not.toBeNull()
      expect(hatch()).not.toBeNull()
    })

    // A finished answer, so there is nowhere to be sent: the dimension is
    // settled and no criterion is coming.
    it("stands empty, tested and found not material, with nowhere to go", () => {
      modelResult = makeModel(BALANCED.criteria, decision("testedNotMaterial"))
      renderChapter()
      expect(lineNode("columnNotMaterial")).not.toBeNull()
      expect(within(workingConditionsColumn()).queryByRole("link")).toBeNull()
      expect(hatch()).not.toBeNull()
    })

    // The heading keeps this chapter's lens on the column it explains: a
    // dimension carrying nothing carries 0% of the weight, which is true.
    it("keeps its share in the heading, at an honest zero", () => {
      renderChapter()
      expect(
        screen.getByRole("heading", { name: /Working conditions/ }).textContent
      ).toBe(
        weighting.dimensionShare
          .replace("{dimension}", "Working conditions")
          .replace("<share></share>", "0%")
      )
    })

    // Staffed, the column is every other column: its criterion's weight row,
    // and no explanation of an emptiness that is not there.
    it("weights its criterion, and drops the hatch, once one is chosen", () => {
      modelResult = makeModel(
        [
          ...BALANCED.criteria,
          criterion({
            criterionId: "c6",
            libraryKey: "safety-exposure",
            dimensionKey: "workingConditions",
            name: "Safety exposure",
            weightPoints: 3,
            order: 6,
          }),
        ],
        decision("active")
      )
      renderChapter()
      expect(
        within(workingConditionsColumn()).getAllByRole("group")
      ).toHaveLength(1)
      expect(hatch()).toBeNull()
      expect(lineNode("columnMaterial")).toBeNull()
    })
  })

  // The dominance warning WHERE THE DECISION IS MADE. It used to exist only as
  // a verdict on the Godkännande checklist two chapters later, with no surface
  // anywhere in the app that could write the motivation it asked for.
  describe("the dominance note", () => {
    const noteFor = (key: "dominanceNote" | "dominanceMotivatedNote") =>
      weighting[key]
        .replace("{dimension}", "Responsibility and impact")
        .replace("{share}", "53%")

    it("names the dominant dimension and its share, and offers the motivation", () => {
      renderChapter()
      expect(screen.getByText(noteFor("dominanceNote"))).toBeDefined()
      expect(
        screen.getByRole("button", { name: weighting.motivateCta })
      ).toBeDefined()
    })

    // The dimensions that are NOT dominant say nothing at all: a note on every
    // column would be four notes and no finding.
    it("says nothing about a dimension under the threshold", () => {
      renderChapter()
      const competence = screen
        .getByRole("heading", { name: /Competence/ })
        .closest("section") as HTMLElement
      expect(
        within(competence).queryByRole("button", {
          name: weighting.motivateCta,
        })
      ).toBeNull()
      expect(
        within(competence).queryByRole("button", {
          name: weighting.editMotivationCta,
        })
      ).toBeNull()
    })

    // The engine decides, not the chapter: once dimensionWeightBalance stops
    // naming the dimension the warning is gone, and what stays is the reading
    // plus the way back into the text.
    it("drops the warning once the engine reports the dimension motivated", () => {
      methodChecksResult = checksFor([])
      renderChapter()
      expect(screen.queryByText(noteFor("dominanceNote"))).toBeNull()
      expect(screen.getByText(noteFor("dominanceMotivatedNote"))).toBeDefined()
      expect(
        screen.getByRole("button", { name: weighting.editMotivationCta })
      ).toBeDefined()
    })

    it("writes the motivation to the heaviest criterion in the dimension", async () => {
      renderChapter()
      fireEvent.click(
        screen.getByRole("button", { name: weighting.motivateCta })
      )
      // The dialog names the criterion the text lands on rather than storing it
      // out of sight. Responsibility holds 2 + 3 + 3: "Scope and impact" and
      // "Risk and consequence" tie at 3, and display order breaks it.
      expect(
        screen.getByText(
          weighting.motivationDialogDescription
            .replace("{subject}", "Responsibility and impact")
            .replace("{criterion}", "Scope and impact")
        )
      ).toBeDefined()

      const submit = screen.getByRole("button", {
        name: weighting.motivationSaveCta,
      }) as HTMLButtonElement
      // Nothing typed yet: the save is shut, so an empty motivation can never
      // be written over a warning it would not answer.
      expect(submit.disabled).toBe(true)
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "Accountability drives pay in this organization." },
      })
      await waitFor(() => {
        expect(submit.disabled).toBe(false)
      })
      fireEvent.click(submit)
      await waitFor(() => {
        expect(setMotivation).toHaveBeenCalledWith({
          orgId: "org-1",
          criterionId: "c3",
          motivation: "Accountability drives pay in this organization.",
        })
      })
    })

    // An existing motivation is EDITED where it lives, never shadowed by a
    // second copy on whichever criterion has since become the heaviest.
    it("reopens the criterion that already carries the motivation", () => {
      modelResult = makeModel(
        BALANCED.criteria.map((entry) =>
          entry.criterionId === "c2"
            ? { ...entry, weightMotivation: "Already recorded." }
            : entry
        )
      )
      methodChecksResult = checksFor([])
      renderChapter()
      fireEvent.click(
        screen.getByRole("button", { name: weighting.editMotivationCta })
      )
      expect(
        screen.getByText(
          weighting.motivationDialogDescription
            .replace("{subject}", "Responsibility and impact")
            .replace("{criterion}", "Autonomy and decision mandate")
        )
      ).toBeDefined()
      expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
        "Already recorded."
      )
    })

    // Writing a motivation is an adminMutation. An editor reads the note (it
    // explains the balance they are looking at) and is offered no control.
    it("shows an editor the note without offering the write", () => {
      orgRole = "editor"
      renderChapter()
      expect(screen.getByText(noteFor("dominanceNote"))).toBeDefined()
      expect(
        screen.queryByRole("button", { name: weighting.motivateCta })
      ).toBeNull()
    })
  })

  // The model's OTHER weight warning has the same shape and the same missing
  // write path: it asks about one criterion, not a dimension, and clears only
  // on that criterion's own motivation.
  describe("the people-leadership note", () => {
    const LEADERSHIP = "People and management responsibility"

    // Four criteria on a budget of 12, with responsibility deliberately UNDER
    // the dominance threshold (4 of 12, or 3 of 12), so the only note in the
    // column is the leadership one and the two cases stay separable.
    function withLeadership(points: number) {
      modelResult = makeModel([
        criterion({
          criterionId: "c1",
          libraryKey: "people-leadership",
          dimensionKey: "responsibility",
          name: LEADERSHIP,
          weightPoints: points,
          order: 1,
        }),
        criterion({
          criterionId: "c2",
          libraryKey: "complexity-ambiguity",
          dimensionKey: "effort",
          name: COMPLEXITY,
          weightPoints: 4,
          order: 2,
        }),
        criterion({
          criterionId: "c3",
          libraryKey: "knowledge-depth",
          dimensionKey: "competence",
          name: KNOWLEDGE_DEPTH,
          weightPoints: 3,
          order: 3,
        }),
        criterion({
          criterionId: "c4",
          libraryKey: "analytical-effort",
          dimensionKey: "effort",
          name: "Analytical effort",
          weightPoints: 5 - points,
          order: 4,
        }),
      ])
      methodChecksResult = {
        ...checksFor([], points < 4),
        dimensionShares: [
          { key: "competence", share: 3 / 12 },
          { key: "effort", share: (9 - points) / 12 },
          { key: "responsibility", share: points / 12 },
          { key: "workingConditions", share: 0 },
        ],
      }
    }

    it("names the criterion and its weight, and offers the motivation", () => {
      withLeadership(4)
      renderChapter()
      expect(
        screen.getByText(
          weighting.leadershipNote
            .replace("{criterion}", LEADERSHIP)
            .replace("{points}", "4")
        )
      ).toBeDefined()
      expect(
        screen.getByRole("button", { name: weighting.motivateCta })
      ).toBeDefined()
    })

    // Below the high-impact weight class the engine asks nothing, so neither
    // does the chapter.
    it("says nothing below the profile weight floor", () => {
      withLeadership(3)
      renderChapter()
      // The criterion is on the page; it just has nothing asked of it. Scoped
      // to its own column, because the fixture's other dimensions carry their
      // own shares and this assertion is about this one.
      const responsibility = screen
        .getByRole("heading", { name: /Responsibility and impact/ })
        .closest("section") as HTMLElement
      expect(within(responsibility).getByText(LEADERSHIP)).toBeDefined()
      expect(
        within(responsibility).queryByRole("button", {
          name: weighting.motivateCta,
        })
      ).toBeNull()
      expect(
        within(responsibility).queryByRole("button", {
          name: weighting.editMotivationCta,
        })
      ).toBeNull()
    })

    it("writes to the criterion itself, not to the dimension's heaviest", async () => {
      withLeadership(4)
      renderChapter()
      fireEvent.click(
        screen.getByRole("button", { name: weighting.motivateCta })
      )
      // Subject and storage are the same criterion here, so the dialog says so
      // once instead of naming it twice.
      expect(
        screen.getByText(
          weighting.motivationDialogDescriptionSelf.replace(
            "{subject}",
            LEADERSHIP
          )
        )
      ).toBeDefined()
      const submit = screen.getByRole("button", {
        name: weighting.motivationSaveCta,
      }) as HTMLButtonElement
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "Staff responsibility is real work here." },
      })
      await waitFor(() => {
        expect(submit.disabled).toBe(false)
      })
      fireEvent.click(submit)
      await waitFor(() => {
        expect(setMotivation).toHaveBeenCalledWith({
          orgId: "org-1",
          criterionId: "c1",
          motivation: "Staff responsibility is real work here.",
        })
      })
    })

    // One motivation clears both warnings when the dimension's own target IS
    // this criterion, so the column offers one field rather than two that write
    // to the same place.
    it("collapses into the dominance note when they share a criterion", () => {
      modelResult = makeModel([
        criterion({
          criterionId: "c1",
          libraryKey: "people-leadership",
          dimensionKey: "responsibility",
          name: LEADERSHIP,
          weightPoints: 5,
          order: 1,
        }),
        criterion({
          criterionId: "c2",
          libraryKey: "complexity-ambiguity",
          dimensionKey: "effort",
          name: COMPLEXITY,
          weightPoints: 1,
          order: 2,
        }),
      ])
      methodChecksResult = {
        ...checksFor(["responsibility"], false),
        dimensionShares: [
          { key: "competence", share: 0 },
          { key: "effort", share: 1 / 6 },
          { key: "responsibility", share: 5 / 6 },
          { key: "workingConditions", share: 0 },
        ],
      }
      renderChapter()
      expect(
        screen.getAllByRole("button", { name: weighting.motivateCta })
      ).toHaveLength(1)
    })
  })
})
