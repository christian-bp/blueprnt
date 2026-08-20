import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

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

import { ModelBuilder } from "@/components/model/model-builder"
import { mockMutation, onQuery } from "@/test/convex-mocks"
import { openMenu } from "@/test/menu"

const build = messages.dashboard.model.build
const editor = messages.dashboard.model.editor
const dnd = messages.dashboard.dnd.criterion

const activateCriterion = mockMutation(
  "evaluationModel.criteria.activateCriterion"
)
const deactivateCriterion = mockMutation(
  "evaluationModel.criteria.deactivateCriterion"
)
const rebalanceWeights = mockMutation(
  "evaluationModel.criteria.rebalanceWeights"
)

// The four dimensions exactly as getModel serves them (localized library
// content, ADR-0021: fixed method law).
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

// The library's own names for the keys the tests reach for, so an assertion
// reads the same string the surface renders from the library module.
const KNOWLEDGE_DEPTH = "Knowledge depth and specialist level"
const KNOWLEDGE_BREADTH =
  "Knowledge breadth and cross-disciplinary understanding"
const ANALYTICAL = "Analytical and problem-solving effort"
const COMPLEXITY = "Complexity and ambiguity"
const COMMUNICATION = "Communication and relationship effort"
const OPERATIONAL = "Operational intensity and simultaneous demands"
const ANCHOR_LOW = "Follows an established method"
const ANCHOR_HIGH = "Defines how the field works"

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

function makeModel(criteria: ReturnType<typeof criterion>[]) {
  return {
    modelId: "model-1",
    name: "Standard",
    approval: null,
    workingConditions: null,
    criteria,
    sharedScale: [],
    midpoints: { step2: "", step4: "" },
    dimensions: DIMENSIONS,
    tracks: [],
    levelRules: [{ level: 1, minScore: 100 }],
    zoneProfileRules: [],
  }
}

// Five criteria summing to the budget (5 x 3 = 15), spread so competence and
// effort still have room: a dimension at its cap closes its library cards,
// which is its own test below.
const BALANCED = makeModel([
  criterion({
    criterionId: "c1",
    libraryKey: "complexity-ambiguity",
    dimensionKey: "effort",
    name: COMPLEXITY,
    weightPoints: 4,
    order: 1,
    // The wire carries every selected criterion's anchor texts; this surface
    // renders none of them, which the scale test below reads these back for.
    anchors: [
      { step: 1, text: ANCHOR_LOW },
      { step: 5, text: ANCHOR_HIGH },
    ],
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

// Competence at its cap of two, so its remaining library cards are closed.
const COMPETENCE_FULL = makeModel([
  criterion({
    criterionId: "c1",
    libraryKey: "knowledge-depth",
    dimensionKey: "competence",
    name: KNOWLEDGE_DEPTH,
    order: 1,
  }),
  criterion({
    criterionId: "c2",
    libraryKey: "knowledge-breadth",
    dimensionKey: "competence",
    name: KNOWLEDGE_BREADTH,
    order: 2,
  }),
])

let modelResult: unknown = BALANCED
let industryResult: string | null = "itTelecom"

function renderBuilder() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ModelBuilder orgId="org-1" />
    </NextIntlClientProvider>
  )
}

// happy-dom has no layout (every rect is zero), so the four columns are
// declared here and handed to getBoundingClientRect: a drag IS geometry, and
// without it every zone would sit on top of every other.
const COLUMN_WIDTH = 300
const COLUMN_GAP = 20
const ZERO = makeRect({ left: 0, top: 0, width: 0, height: 0 })
const rects = new WeakMap<Element, DOMRect>()
const originalGetRect = Element.prototype.getBoundingClientRect

function makeRect(box: {
  left: number
  top: number
  width: number
  height: number
}): DOMRect {
  return {
    ...box,
    x: box.left,
    y: box.top,
    right: box.left + box.width,
    bottom: box.top + box.height,
    toJSON: () => box,
  }
}

function columnLeft(index: number) {
  return index * (COLUMN_WIDTH + COLUMN_GAP)
}

const zone = (name: string) => screen.getByRole("region", { name })
// The draggable body carries no label of its own, so it is found the way a
// screen reader names it: by the content inside it.
const cardBody = (name: string) =>
  screen.getByRole("button", { name: (label) => label.startsWith(name) })
const addButton = (name: string) =>
  screen.getByRole("button", { name: build.addLabel.replace("{name}", name) })
// dnd-kit narrates the drag into its own live region; there is exactly one per
// mounted DndContext.
const liveRegion = () => screen.getByRole("status")

// Lays the grid out as the view lays it out: the four zones in a row, each
// dragged card in its own dimension's column directly below its zone.
function measure(cards: { name: string; column: number }[]) {
  for (const [index, dimension] of DIMENSIONS.entries()) {
    rects.set(
      zone(dimension.name),
      makeRect({
        left: columnLeft(index),
        top: 0,
        width: COLUMN_WIDTH,
        height: 160,
      })
    )
  }
  for (const { name, column } of cards) {
    rects.set(
      cardBody(name),
      makeRect({
        left: columnLeft(column),
        top: 220,
        width: 280,
        height: 70,
      })
    )
  }
}

// The keyboard sensor arms its document listener on a macrotask, so a press
// fired in the same tick as the pick-up would land on nothing.
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function press(target: Element | Document, code: string) {
  await act(async () => {
    fireEvent.keyDown(target, { code, key: code === "Space" ? " " : code })
  })
}

async function pickUp(name: string) {
  await press(cardBody(name), "Space")
  await settle()
}

const move = (code: string) => press(document, code)
const drop = () => press(document, "Space")

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function measured(this: Element) {
    const declared = rects.get(this)
    if (declared !== undefined) return declared
    // dnd-kit's drag overlay is what collision detection measures once a card
    // is in flight, not the card left behind in the list, and the overlay
    // positions itself with inline styles instead of through layout. happy-dom
    // has no layout, so its box is read back from the styles it just set. The
    // parent is checked too because dnd-kit measures the overlay's single
    // CHILD (getMeasurableNode), which inherits the box its wrapper declares.
    for (const node of [this as HTMLElement, this.parentElement]) {
      const style = node?.style
      if (style?.position === "fixed" && style.width !== "") {
        return makeRect({
          left: Number.parseFloat(style.left),
          top: Number.parseFloat(style.top),
          width: Number.parseFloat(style.width),
          height: Number.parseFloat(style.height),
        })
      }
    }
    return ZERO
  }
})
afterAll(() => {
  Element.prototype.getBoundingClientRect = originalGetRect
})

describe("the model build view", () => {
  beforeEach(() => {
    activateCriterion.mockReset()
    deactivateCriterion.mockReset()
    rebalanceWeights.mockReset()
    activateCriterion.mockResolvedValue("c9")
    deactivateCriterion.mockResolvedValue(null)
    rebalanceWeights.mockResolvedValue(null)
    modelResult = BALANCED
    industryResult = "itTelecom"
    onQuery((ref) => {
      if (ref === "evaluationModel.model.getModel") return modelResult
      if (ref === "accounts.organization.getOrganizationSettings") {
        return { orgId: "org-1", industry: industryResult }
      }
      if (ref === "ai.suggest.getWeightReviewLock") return false
      if (ref === "ai.suggest.getOpenSuggestions") return []
      return undefined
    })
  })
  afterEach(() => cleanup())

  it("shows every dimension as a zone with its own library beneath it", () => {
    renderBuilder()
    for (const dimension of DIMENSIONS) {
      expect(zone(dimension.name)).toBeDefined()
    }
    // The chosen criteria sit in their dimension's zone.
    expect(within(zone("Competence")).getByText(KNOWLEDGE_DEPTH)).toBeDefined()
    // The rest of that dimension's library is offered directly below it.
    expect(cardBody(KNOWLEDGE_BREADTH)).toBeDefined()
  })

  // The whole reason criteria and weights could be brought onto one page: the
  // role-facing 1-5 scale is not here to be confused with the 1-5 weighting.
  it("never renders the evaluation scale", () => {
    renderBuilder()
    expect(screen.getByText(COMPLEXITY)).toBeDefined()
    expect(screen.queryByText(ANCHOR_LOW)).toBeNull()
    expect(screen.queryByText(ANCHOR_HIGH)).toBeNull()
  })

  // A hint from the library's combination tables, never a selection: the org's
  // industry decides which cards carry it, so a card only wears the chip while
  // the settings read says so.
  it("chips the criteria the organization's industry points at", () => {
    renderBuilder()
    // itTelecom hints at six criteria and five of them are already selected,
    // so exactly one card in the whole library is left to recommend.
    expect(screen.getAllByText(build.recommendedChip)).toHaveLength(1)
    expect(cardBody(KNOWLEDGE_BREADTH).textContent).toContain(
      build.recommendedChip
    )
  })

  it("recommends nothing when the organization has no industry", () => {
    industryResult = null
    renderBuilder()
    expect(screen.queryByText(build.recommendedChip)).toBeNull()
  })

  // "Overlaps something" is a warning nobody can act on, so the chip names the
  // criterion already in the model that this one would double up on.
  it("names the selected criterion a library card would overlap", () => {
    renderBuilder()
    expect(cardBody(KNOWLEDGE_BREADTH).textContent).toContain(
      build.overlapChip.replace("{names}", KNOWLEDGE_DEPTH)
    )
    expect(cardBody(ANALYTICAL).textContent).toContain(
      build.overlapChip.replace("{names}", COMPLEXITY)
    )
    // A criterion in no overlap pair carries no warning at all.
    expect(cardBody(COMMUNICATION).textContent).not.toContain(
      build.overlapChip.replace("{names}", "")
    )
  })

  it("adds a criterion when its card is dropped in its own dimension", async () => {
    renderBuilder()
    measure([{ name: ANALYTICAL, column: 1 }])

    await pickUp(ANALYTICAL)
    await move("ArrowUp")
    await drop()

    await waitFor(() => {
      expect(activateCriterion).toHaveBeenCalledWith({
        orgId: "org-1",
        libraryKey: "analytical-effort",
      })
    })
  })

  // The zone stays a live droppable so it can say no while the card is still
  // in the air. What it must never do is let the drop through.
  it("refuses a card dropped on another dimension's zone", async () => {
    renderBuilder()
    measure([{ name: ANALYTICAL, column: 1 }])

    await pickUp(ANALYTICAL)
    await move("ArrowUp")
    await move("ArrowLeft")
    expect(zone("Competence").dataset.state).toBe("blocked")
    await drop()

    expect(activateCriterion).not.toHaveBeenCalled()
  })

  // The zone's tint is the answer for a reader who can see it. This is the
  // same answer for a reader who cannot: the refusal, with its reason, through
  // dnd-kit's live region. It fails if the two refusal branches are swapped or
  // if the accessibility props stop reaching the DndContext.
  it("says the refusal out loud, with its reason", async () => {
    renderBuilder()
    measure([{ name: ANALYTICAL, column: 1 }])

    await pickUp(ANALYTICAL)
    await move("ArrowUp")
    await move("ArrowLeft")
    expect(liveRegion().textContent).toBe(
      dnd.wrongDimension
        .replace("{name}", ANALYTICAL)
        .replace("{dimension}", "Competence")
    )

    await drop()
    expect(liveRegion().textContent).toBe(
      dnd.notAddedWrongDimension
        .replace("{name}", ANALYTICAL)
        .replace("{dimension}", "Competence")
    )
  })

  // Two equal routes in: the button is not a fallback for people who cannot
  // drag, it is the faster route for everyone, and it lands on exactly the
  // same call.
  it("adds the same criterion from its Add button", async () => {
    renderBuilder()
    fireEvent.click(addButton(ANALYTICAL))
    await waitFor(() => {
      expect(activateCriterion).toHaveBeenCalledWith({
        orgId: "org-1",
        libraryKey: "analytical-effort",
      })
    })
  })

  // The same criterion cannot be added twice at once. What matters is not only
  // that the second call never happens: a gesture that is refused has to SAY
  // so, because a reader told "added" while nothing happened has no way to
  // find out otherwise.
  it("refuses a repeat add of a criterion already in flight, out loud", async () => {
    const pending = new Map<string, (value: string) => void>()
    activateCriterion.mockImplementation(
      ({ libraryKey }: { libraryKey: string }) =>
        new Promise<string>((resolve) => {
          pending.set(libraryKey, resolve)
        })
    )
    renderBuilder()
    measure([{ name: ANALYTICAL, column: 1 }])

    // The first add starts and stays in flight.
    fireEvent.click(addButton(ANALYTICAL))
    await waitFor(() => {
      expect((addButton(ANALYTICAL) as HTMLButtonElement).disabled).toBe(true)
    })
    expect(activateCriterion).toHaveBeenCalledTimes(1)

    // The button route is closed while it holds, so the gesture cannot even
    // be made a second time.
    fireEvent.click(addButton(ANALYTICAL))
    expect(activateCriterion).toHaveBeenCalledTimes(1)

    // The drag route stays open (a card that stopped being grabbable under the
    // hand would be the worse answer), so it refuses out loud instead.
    await pickUp(ANALYTICAL)
    await move("ArrowUp")
    await drop()
    expect(activateCriterion).toHaveBeenCalledTimes(1)
    expect(liveRegion().textContent).toBe(
      dnd.notAddedBusy.replace("{name}", ANALYTICAL)
    )

    // A DIFFERENT criterion is not held up by it: the backend serializes the
    // two, enforces both caps, and rejects a duplicate with its own code.
    fireEvent.click(addButton(OPERATIONAL))
    await waitFor(() => {
      expect(activateCriterion).toHaveBeenCalledTimes(2)
    })

    // The card reopens once its own add lands.
    pending.get("analytical-effort")?.("c9")
    await waitFor(() => {
      expect((addButton(ANALYTICAL) as HTMLButtonElement).disabled).toBe(false)
    })
    pending.get("operational-intensity")?.("c10")
  })

  // A flow states its preconditions in words rather than silently refusing.
  it("dims a full dimension's remaining cards and says why", () => {
    modelResult = COMPETENCE_FULL
    renderBuilder()

    expect(zone("Competence").dataset.full).toBe("true")
    const reason = build.capDimension.replace("{max}", "2")
    // One sentence per closed card, on the card itself, where the reader is
    // reaching.
    expect(screen.getAllByText(reason).length).toBe(3)
    expect(
      (
        addButton(
          "Formal qualification, licensing and certification requirements"
        ) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    // A dimension with room says nothing of the kind.
    expect(zone("Effort and complexity").dataset.full).toBe("false")
    expect((addButton(ANALYTICAL) as HTMLButtonElement).disabled).toBe(false)
  })

  it("saves the whole allocation at once, and only when it balances", async () => {
    renderBuilder()
    const groupFor = (name: string) =>
      screen.getByRole("group", {
        name: build.setWeightPoints.replace("{name}", name),
      })
    const save = () => screen.getByRole("button", { name: build.saveCta })

    // Nothing edited yet: balanced but clean, so there is nothing to post.
    expect(screen.getByText(build.balanced)).toBeDefined()
    expect((save() as HTMLButtonElement).disabled).toBe(true)

    // c1 4 -> 3 alone leaves the budget short: the save stays shut and the bar
    // stops claiming the points are distributed.
    fireEvent.click(
      within(groupFor(COMPLEXITY)).getByRole("button", { name: "3" })
    )
    expect((save() as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText(build.balanced)).toBeNull()
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

  // Removing a criterion deletes its ratings on every role, so it confirms.
  it("confirms before removing a criterion", async () => {
    renderBuilder()
    await openMenu(
      screen.getByRole("button", {
        name: editor.rowMenuLabel.replace("{name}", KNOWLEDGE_DEPTH),
      })
    )
    fireEvent.click(screen.getByRole("menuitem", { name: editor.removeCta }))
    expect(deactivateCriterion).not.toHaveBeenCalled()
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: editor.removeConfirm,
      })
    )
    await waitFor(() => {
      expect(deactivateCriterion).toHaveBeenCalledWith({
        orgId: "org-1",
        criterionId: "c4",
      })
    })
  })

  it("shows the build grid's own skeleton while the model loads", () => {
    modelResult = undefined
    renderBuilder()
    // The four dimensions are already on screen, in the same grid, over the
    // same budget bar: what is missing is only the data.
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)
    ).toEqual(DIMENSIONS.map((dimension) => dimension.name))
    // The save is real and disabled, which is the truthful state rather than a
    // loading effect: the loaded bar opens clean, where it is disabled too.
    const save = screen.getByRole("button", { name: build.saveCta })
    expect((save as HTMLButtonElement).disabled).toBe(true)
    // Nothing is placed yet, so no weight row exists to be edited.
    expect(screen.queryAllByRole("group")).toHaveLength(0)
  })
})
