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
// NumberFlow renders a custom element happy-dom never upgrades, so its
// getSnapshotBeforeUpdate throws the moment the value CHANGES in place, which
// is exactly what a weight click does to the budget readout. The digit
// animation is the library's business; these tests are about the figures.
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))

import { WeightingChapter } from "@/components/model/weighting-chapter"
import { mockMutation, onQuery } from "@/test/convex-mocks"

const weighting = messages.dashboard.model.weighting
const editor = messages.dashboard.model.editor

const rebalanceWeights = mockMutation(
  "evaluationModel.criteria.rebalanceWeights"
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
    weightMotivation: null,
    ...overrides,
  }
}

function makeModel(entries: ReturnType<typeof criterion>[]) {
  return {
    modelId: "model-1",
    name: "Standard",
    approval: null,
    workingConditions: null,
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

describe("the Viktning chapter", () => {
  beforeEach(() => {
    rebalanceWeights.mockReset()
    rebalanceWeights.mockResolvedValue(null)
    modelResult = BALANCED
    onQuery((ref) => {
      if (ref === "evaluationModel.model.getModel") return modelResult
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
      .getByRole("heading", { name: "Responsibility and impact" })
      .closest("section") as HTMLElement
    expect(within(responsibility).getAllByRole("group")).toHaveLength(3)
    expect(groupFor(COMPLEXITY)).toBeDefined()
    // A dimension with nothing chosen draws no empty column here.
    expect(
      screen.queryByRole("heading", { name: "Working conditions" })
    ).toBeNull()
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

  // Same as the Kriterier chapter: uncapped width divided by one shared grid
  // constant, so the loading and loaded states can never drift apart.
  it("lays the loading and loaded grids out with the same classes", () => {
    const { container: loaded } = renderChapter()
    const loadedGrid = loaded.querySelector('[class*="grid-cols"]')?.className
    cleanup()
    modelResult = undefined
    const { container: loading } = renderChapter()
    expect(loading.querySelector('[class*="grid-cols"]')?.className).toBe(
      loadedGrid
    )
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
})
