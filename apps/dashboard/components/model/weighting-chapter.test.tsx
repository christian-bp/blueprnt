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
import { WARNING_ALERT_CLASS } from "@/lib/alert-tone"
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
  { key: "competence", name: "Competence" },
  { key: "effort", name: "Effort and complexity" },
  {
    key: "responsibility",
    name: "Responsibility and impact",
  },
  {
    key: "workingConditions",
    name: "Working conditions",
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
// The save lives in the floating pill, which is only on screen when the
// allocation is unsaved: querying it is therefore also an assertion that the
// pill is up.
const save = () => screen.getByRole("button", { name: weighting.saveCta })
const querySave = () =>
  screen.queryByRole("button", { name: weighting.saveCta })
// The pill's readout, as its one message renders it. Matched on the whole
// span: its two figures are their own elements (they roll through NumberFlow),
// which the default text matcher does not join.
const readoutText = (allocated: string, budget: string) =>
  weighting.budgetAllocated
    .replace("<allocated></allocated>", allocated)
    .replace("<budget></budget>", budget)
const readoutNode = (allocated: string, budget: string) =>
  screen.queryByText(
    (_, node) =>
      node?.tagName === "SPAN" &&
      node.textContent === readoutText(allocated, budget)
  )

// A dimension's heading row (the frame's own two-sided slot), its name, and the
// share opposite it.
const headingRow = (name: string) =>
  screen.getByRole("heading", { name }).parentElement as HTMLElement
const headingFor = (name: string) =>
  screen.getByRole("heading", { name }).textContent
const shareFor = (name: string) =>
  headingRow(name).lastElementChild?.textContent
// The share as its one message renders it, rather than as a literal repeated
// per assertion.
const shareText = (share: string) =>
  weighting.shareOfWeight.replace("<share></share>", share)

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
  // heading row now carries its dimension's own share, derived from the LOCAL
  // allocation so it moves with an unsaved edit.
  it("shows each dimension's own share opposite its name, live", () => {
    renderChapter()
    // BALANCED is 4+2+3+3+3 = 15: responsibility holds 2+3+3 = 8, competence 3,
    // effort 4.
    expect(headingFor("Responsibility and impact")).toBe(
      "Responsibility and impact"
    )
    expect(shareFor("Responsibility and impact")).toBe(shareText("53%"))
    expect(headingFor("Competence")).toBe("Competence")
    expect(shareFor("Competence")).toBe(shareText("20%"))
    expect(shareFor("Effort and complexity")).toBe(shareText("27%"))

    // An unsaved edit moves it: dropping effort from 4 to 1 rebalances the
    // shares before anything is saved.
    fireEvent.click(
      within(groupFor(COMPLEXITY)).getByRole("button", { name: "1" })
    )
    expect(shareFor("Effort and complexity")).toBe(shareText("8%"))
  })

  // The name is the whole heading, and the share is the element opposite it:
  // the Kriterier column's title-left/chip-right anatomy, in the same frame's
  // heading row. A share spliced into the title truncates away first at column
  // width, which is the half a reader comes to this chapter for.
  it("splits the heading row into the name and the share", () => {
    renderChapter()
    const row = headingRow("Competence")
    expect(row.children).toHaveLength(2)
    expect(row.children[0]?.tagName).toBe("H3")
    expect(row.children[0]?.textContent).toBe("Competence")
    expect(row.children[1]?.textContent).toBe(shareText("20%"))
    // The figure never shrinks away with the name beside it.
    expect((row.children[1]?.className ?? "").split(/\s+/)).toContain(
      "shrink-0"
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
    // Nothing edited yet: balanced and saved, so the pill has nothing to say
    // and nothing to offer, and it is not on screen at all.
    expect(querySave()).toBeNull()

    // c1 4 -> 3 alone leaves the budget short: the pill says what is missing
    // and offers no save.
    fireEvent.click(
      within(groupFor(COMPLEXITY)).getByRole("button", { name: "3" })
    )
    expect(querySave()).toBeNull()
    expect(screen.getByText("1 weight point left to distribute")).toBeDefined()

    // Compensating elsewhere balances it: the pill swaps to the readout and
    // the save, and the save posts every criterion.
    fireEvent.click(
      within(groupFor("Autonomy and decision mandate")).getByRole("button", {
        name: "3",
      })
    )
    expect(screen.queryByText("1 weight point left to distribute")).toBeNull()
    expect(readoutNode("15", "15")).not.toBeNull()
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
    // Nothing to allocate is nothing to say: the pill stays away entirely.
    expect(querySave()).toBeNull()
  })

  // The budget floats clear of the chapter instead of opening it: a block at
  // the top would push this chapter's grid below the other chapters', and
  // switching tabs would jump.
  describe("the budget pill", () => {
    // Fixed, so it is out of flow and can push nothing.
    const pillOf = (node: Element) =>
      node.closest('[class*="fixed"]') as HTMLElement | null

    it("says nothing while the allocation adds up and is saved", () => {
      const { container } = renderChapter()
      expect(querySave()).toBeNull()
      expect(
        container.querySelector('[class*="fixed"]')?.textContent ?? ""
      ).toBe("")
    })

    // The three tones are the status block's own language, carried over when
    // the block became a pill: distributing the last points is the ordinary
    // way through this chapter, an allocation over its budget is a state the
    // model cannot be saved from, and one that adds up is done. They must not
    // read alike at a glance.
    const toneOf = (node: Element) =>
      node.closest("[data-tone]")?.getAttribute("data-tone")
    const pillClasses = (node: Element) =>
      (node.closest("[data-tone]")?.className ?? "").split(/\s+/)

    it("says what is missing while the allocation does not add up", () => {
      renderChapter()
      fireEvent.click(
        within(groupFor(COMPLEXITY)).getByRole("button", { name: "3" })
      )
      const line = screen.getByText("1 weight point left to distribute")
      expect(pillOf(line)).not.toBeNull()
      // The one shared shell, the same one the Kriterier chapter's own pill
      // is built from: a chapter that hand-rolled its own would lose this
      // marker and fail here.
      expect(line.closest('[data-slot="floating-pill"]')).not.toBeNull()
      // Informative, not alarming: being mid-allocation is the ordinary state.
      expect(toneOf(line)).toBe("info")
      expect(pillClasses(line).join(" ")).not.toContain("amber")
      // Nothing to save while it does not add up.
      expect(querySave()).toBeNull()
    })

    it("warns, in the app's amber, once the allocation is over its budget", () => {
      renderChapter()
      fireEvent.click(
        within(groupFor(COMPLEXITY)).getByRole("button", { name: "5" })
      )
      const line = screen.getByText("1 weight point over the budget")
      expect(querySave()).toBeNull()
      expect(toneOf(line)).toBe("warning")
      // The one amber the app defines, tinting border and text together.
      const classes = pillClasses(line)
      expect(classes).toEqual(
        expect.arrayContaining(WARNING_ALERT_CLASS.split(/\s+/))
      )
    })

    it("offers the readout and the save once it adds up unsaved", () => {
      renderChapter()
      fireEvent.click(
        within(groupFor(COMPLEXITY)).getByRole("button", { name: "3" })
      )
      fireEvent.click(
        within(groupFor("Autonomy and decision mandate")).getByRole("button", {
          name: "3",
        })
      )
      const readout = readoutNode("15", "15") as HTMLElement
      expect(pillOf(readout)).not.toBeNull()
      expect(pillOf(save())).toBe(pillOf(readout))
      // It adds up: the check, and no warning tint anywhere on the pill.
      expect(toneOf(readout)).toBe("ready")
      expect(pillClasses(readout).join(" ")).not.toContain("amber")
      // The save carries the action colour, which is the design system's
      // primary: it is the one thing in the pill meant to be pressed. It is
      // sized and shaped to its host rather than to the framing row: a
      // capsule inside the pill's capsule, at the compact size, because a
      // default-height block in a floating pill dominates the readout it
      // serves.
      const classes = save().className.split(/\s+/)
      expect(classes).toContain("bg-primary")
      expect(classes).toContain("h-8")
      expect(classes).toContain("rounded-full")
      // The figures roll rather than swap: they change while the reader
      // watches. (NumberFlow is mocked here to a plain span carrying its
      // value, so their presence is what is asserted.)
      expect(readout.textContent).toContain("15")
    })

    // It floats, so it can never sit between the framing row and the grid, and
    // the columns begin where every other chapter's do.
    it("is fixed, out of the chapter's own flow", () => {
      const { container } = renderChapter()
      fireEvent.click(
        within(groupFor(COMPLEXITY)).getByRole("button", { name: "3" })
      )
      const rail = container.querySelector('[class*="fixed"]') as HTMLElement
      expect(rail.className.split(/\s+/)).toContain("fixed")
      // Last in the chapter's own DOM, after the grid it floats over.
      expect(rail.previousElementSibling?.className ?? "").toContain(
        "sm:grid-cols-2"
      )
    })
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
    // The framing row is the chapter's chrome, not its data: it renders for
    // real, so nothing shifts when the model arrives.
    expect(
      screen.getByText(messages.dashboard.model.chapters.framing.weighting)
    ).toBeDefined()
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.help.weightingLabel,
      })
    ).toBeDefined()
    // No pill: what it would say is exactly what is still loading.
    expect(querySave()).toBeNull()
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
    // Two placeholder cards each, for the three dimensions whose staffed
    // shape is the near-certain one.
    expect(container.querySelectorAll("ul li")).toHaveLength(6)
  })

  // The fourth dimension resolves as readily to a sentence over a hatch as to
  // a card (many organizations test it and find it not material), so its
  // loading shape guesses neither: a text-line bar that either outcome fills
  // in, rather than a card that would have to become a paragraph.
  it("waits for the fourth dimension with a neutral bar, not a card", () => {
    modelResult = undefined
    const { container } = renderChapter()
    const grid = container.querySelector('[class*="sm:grid-cols-2"]')
    // DIMENSION_KEYS order, which is fixed method law: working conditions is
    // the fourth column.
    const wc = grid?.children[3] as HTMLElement
    expect(wc.querySelector("li")).toBeNull()
    expect(wc.querySelector('[class*="border"]')).toBeNull()
    expect(within(wc).queryByRole("img")).toBeNull()
    expect(
      wc.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
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
      expect(headingFor("Working conditions")).toBe("Working conditions")
      expect(shareFor("Working conditions")).toBe(shareText("0%"))
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

    // Weighting is member-level work: admin covers org administration and the
    // audit log, so an editor reads the note AND answers it.
    it("offers an editor the note and its write", () => {
      orgRole = "editor"
      renderChapter()
      expect(screen.getByText(noteFor("dominanceNote"))).toBeDefined()
      expect(
        screen.getByRole("button", { name: weighting.motivateCta })
      ).toBeDefined()
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
