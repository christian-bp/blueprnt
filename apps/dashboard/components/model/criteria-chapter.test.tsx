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
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { CriteriaChapter } from "@/components/model/criteria-chapter"
import { toast } from "@/lib/toast"
import { mockMutation, onQuery } from "@/test/convex-mocks"

const criteria = messages.dashboard.model.criteria
const picker = messages.dashboard.model.picker
const editor = messages.dashboard.model.editor
const weighting = messages.dashboard.model.weighting

const activateCriterion = mockMutation(
  "evaluationModel.criteria.activateCriterion"
)
const deactivateCriterion = mockMutation(
  "evaluationModel.criteria.deactivateCriterion"
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
// The library's own one-liner for complexity-ambiguity, so the assertion reads
// the same string the surface renders from the library module.
const COMPLEXITY_SHORT =
  "The role's requirement to handle uncertainty, multi-faceted questions and unclear frames with qualified judgment."

const COMMUNICATION = "Communication and relationship effort"
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

const SELECTION = makeModel([
  criterion({
    criterionId: "c1",
    libraryKey: "complexity-ambiguity",
    dimensionKey: "effort",
    name: COMPLEXITY,
    shortUiText: COMPLEXITY_SHORT,
    order: 1,
    // The wire carries every chosen criterion's anchor texts; this surface
    // renders none of them, which the scale test below reads these back for.
    anchors: [
      { step: 1, text: ANCHOR_LOW },
      { step: 5, text: ANCHOR_HIGH },
    ],
  }),
  criterion({
    criterionId: "c4",
    libraryKey: "knowledge-depth",
    dimensionKey: "competence",
    name: KNOWLEDGE_DEPTH,
    order: 2,
  }),
])

// Competence at its cap of two, so the dimension can take nothing more.
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

// Eight criteria: the model itself is full, so every column is closed even
// where the dimension still has room.
const MODEL_FULL = makeModel([
  criterion({
    criterionId: "m1",
    libraryKey: "knowledge-depth",
    dimensionKey: "competence",
    name: KNOWLEDGE_DEPTH,
    order: 1,
  }),
  criterion({
    criterionId: "m2",
    libraryKey: "knowledge-breadth",
    dimensionKey: "competence",
    name: KNOWLEDGE_BREADTH,
    order: 2,
  }),
  criterion({
    criterionId: "m3",
    libraryKey: "complexity-ambiguity",
    dimensionKey: "effort",
    name: COMPLEXITY,
    order: 3,
  }),
  criterion({
    criterionId: "m4",
    libraryKey: "analytical-effort",
    dimensionKey: "effort",
    name: ANALYTICAL,
    order: 4,
  }),
  criterion({
    criterionId: "m5",
    libraryKey: "scope-impact",
    dimensionKey: "responsibility",
    name: "Scope and impact",
    order: 5,
  }),
  criterion({
    criterionId: "m6",
    libraryKey: "autonomy-mandate",
    dimensionKey: "responsibility",
    name: "Autonomy and decision mandate",
    order: 6,
  }),
  criterion({
    criterionId: "m7",
    libraryKey: "risk-consequence",
    dimensionKey: "responsibility",
    name: "Risk and consequence",
    order: 7,
  }),
  criterion({
    criterionId: "m8",
    libraryKey: "physical-demands",
    dimensionKey: "workingConditions",
    name: "Physical demands",
    order: 8,
  }),
])

let modelResult: unknown = SELECTION
let industryResult: string | null = "itTelecom"

function renderChapter() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CriteriaChapter orgId="org-1" />
    </NextIntlClientProvider>
  )
}

const column = (name: string) => screen.getByRole("region", { name })
const addButton = (dimension: string) =>
  screen.getByRole("button", {
    name: criteria.addLabel.replace("{dimension}", dimension),
  })

async function openPicker(dimension: string) {
  fireEvent.click(addButton(dimension))
  await screen.findByRole("dialog")
}

describe("the Kriterier chapter", () => {
  beforeEach(() => {
    activateCriterion.mockReset()
    deactivateCriterion.mockReset()
    vi.mocked(toast.success).mockReset()
    activateCriterion.mockResolvedValue("c9")
    deactivateCriterion.mockResolvedValue(null)
    modelResult = SELECTION
    industryResult = "itTelecom"
    onQuery((ref) => {
      if (ref === "evaluationModel.model.getModel") return modelResult
      if (ref === "accounts.organization.getOrganizationSettings") {
        return { orgId: "org-1", industry: industryResult }
      }
      return undefined
    })
  })
  afterEach(() => cleanup())

  it("shows every dimension as a column holding its own chosen criteria", () => {
    renderChapter()
    for (const dimension of DIMENSIONS) {
      expect(column(dimension.name)).toBeDefined()
    }
    expect(
      within(column("Competence")).getByText(KNOWLEDGE_DEPTH)
    ).toBeDefined()
    expect(
      within(column("Effort and complexity")).getByText(COMPLEXITY)
    ).toBeDefined()
  })

  // With the library lists gone from the page there is room for the library's
  // own one-liner on the card, and it is what tells the reader what they
  // actually chose.
  it("says what each chosen criterion is for, on its card", () => {
    renderChapter()
    expect(
      within(column("Effort and complexity")).getByText(COMPLEXITY_SHORT)
    ).toBeDefined()
  })

  // The columns are the SELECTION and nothing else: the library is behind the
  // add dialog, so an unchosen criterion is not on the page at all.
  it("shows only chosen criteria, never the library", () => {
    renderChapter()
    expect(screen.queryByText(KNOWLEDGE_BREADTH)).toBeNull()
    expect(screen.queryByText(ANALYTICAL)).toBeNull()
  })

  // Weighting is the next chapter. A 1-5 weight row beside a criterion the
  // reader is still deciding to include is the confusion the chapters end.
  it("carries no weight row and no evaluation scale", () => {
    renderChapter()
    expect(screen.queryAllByRole("group")).toHaveLength(0)
    expect(screen.queryByText(weighting.shareOfTotal)).toBeNull()
    expect(screen.queryByText(ANCHOR_LOW)).toBeNull()
    expect(screen.queryByText(ANCHOR_HIGH)).toBeNull()
  })

  it("adds a criterion from the dimension's own picker", async () => {
    renderChapter()
    await openPicker("Effort and complexity")
    const dialog = screen.getByRole("dialog")
    // Scoped: this dimension's unchosen criteria, and no other dimension's.
    expect(within(dialog).getByText(ANALYTICAL)).toBeDefined()
    expect(within(dialog).queryByText(KNOWLEDGE_BREADTH)).toBeNull()

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: picker.addRowLabel.replace("{name}", ANALYTICAL),
      })
    )
    await waitFor(() => {
      expect(activateCriterion).toHaveBeenCalledWith({
        orgId: "org-1",
        libraryKey: "analytical-effort",
      })
    })
    // Nothing completes silently, and the dialog gets out of the way of the
    // card it just put in the column.
    expect(vi.mocked(toast.success)).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
  })

  // The same criterion cannot be added twice at once: a double press inside
  // one gesture must not reach the mutation a second time.
  it("refuses a repeat add of a criterion already in flight", async () => {
    let resolveAdd: ((value: string) => void) | undefined
    activateCriterion.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveAdd = resolve
        })
    )
    renderChapter()
    await openPicker("Effort and complexity")
    const add = within(screen.getByRole("dialog")).getByRole("button", {
      name: picker.addRowLabel.replace("{name}", ANALYTICAL),
    })
    fireEvent.click(add)
    fireEvent.click(add)
    expect(activateCriterion).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect((add as HTMLButtonElement).disabled).toBe(true)
    })
    resolveAdd?.("c9")
  })

  // A hint from the library's combination tables, never a selection: the org's
  // industry decides which rows carry it. "Overlaps something" is a warning
  // nobody can act on, so the chip names what it would double up on.
  it("chips the recommended rows and names what a row overlaps", async () => {
    renderChapter()
    await openPicker("Competence")
    const dialog = screen.getByRole("dialog")
    const row = within(dialog)
      .getByText(KNOWLEDGE_BREADTH)
      .closest("li") as HTMLElement
    expect(row.textContent).toContain(criteria.recommendedChip)
    expect(row.textContent).toContain(
      criteria.overlapChip.replace("{names}", KNOWLEDGE_DEPTH)
    )
  })

  // Same rule as the card: a clipped criterion NAME is the one thing a picker
  // must never show. Asserted against ItemTitle's own vendor base
  // (line-clamp-1), since a "not truncate" check passes with the override
  // deleted.
  it("lets a picker row's criterion name wrap rather than clamping it", async () => {
    renderChapter()
    await openPicker("Competence")
    const title = within(screen.getByRole("dialog")).getByText(
      KNOWLEDGE_BREADTH
    )
    expect(title.className).toContain("line-clamp-none")
    expect(title.className).not.toContain("line-clamp-1")
  })

  it("recommends nothing when the organization has no industry", async () => {
    industryResult = null
    renderChapter()
    await openPicker("Competence")
    expect(screen.queryByText(criteria.recommendedChip)).toBeNull()
  })

  it("names no overlap for a criterion in no overlap pair", async () => {
    renderChapter()
    await openPicker("Effort and complexity")
    const row = within(screen.getByRole("dialog"))
      .getByText(COMMUNICATION)
      .closest("li") as HTMLElement
    expect(row.textContent).not.toContain("Overlaps")
  })

  // A flow states its preconditions in words rather than silently refusing,
  // and the sentence REPLACES the control it closes: a button that cannot be
  // pressed says nothing about why.
  it("explains a full dimension in words instead of offering a dead button", () => {
    modelResult = COMPETENCE_FULL
    renderChapter()
    expect(column("Competence").dataset.full).toBe("true")
    expect(
      screen.queryByRole("button", {
        name: criteria.addLabel.replace("{dimension}", "Competence"),
      })
    ).toBeNull()
    expect(
      screen.getByText(criteria.capDimension.replace("{max}", "2"))
    ).toBeDefined()
    // A dimension with room still offers its picker.
    expect(column("Effort and complexity").dataset.full).toBe("false")
    expect(addButton("Effort and complexity")).toBeDefined()
  })

  // A finished selection closes every column, and each says the bound that
  // actually stopped it. The per-dimension caps sum to exactly the model's own
  // ceiling of 8, so a full model is always four full dimensions and it is the
  // dimension's own sentence that is true on each.
  it("closes every column once the model is full, each with its own reason", () => {
    modelResult = MODEL_FULL
    renderChapter()
    for (const dimension of DIMENSIONS) {
      expect(column(dimension.name).dataset.full).toBe("true")
    }
    expect(
      screen.getAllByText(criteria.capDimension.replace("{max}", "2"))
    ).toHaveLength(2)
    expect(
      screen.getByText(criteria.capDimension.replace("{max}", "3"))
    ).toBeDefined()
    expect(
      screen.getByText(criteria.capDimension.replace("{max}", "1"))
    ).toBeDefined()
    // Not one add control anywhere on the chapter: the sentence replaces it.
    expect(
      screen.queryAllByRole("button", { name: criteria.addCta })
    ).toHaveLength(0)
  })

  // Removing a criterion deletes its ratings on every role, so it never fires
  // on one press: the card's trashcan arms into a confirm pill first.
  it("arms, then removes the criterion and says so", async () => {
    renderChapter()
    fireEvent.click(
      screen.getByRole("button", {
        name: editor.removeLabel.replace("{name}", KNOWLEDGE_DEPTH),
      })
    )
    const confirm = await screen.findByRole("button", {
      name: editor.removeConfirm,
    })
    expect(deactivateCriterion).not.toHaveBeenCalled()

    fireEvent.click(confirm)
    await waitFor(() => {
      expect(deactivateCriterion).toHaveBeenCalledWith({
        orgId: "org-1",
        criterionId: "c4",
      })
    })
    // Nothing completes silently.
    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalled()
    })
  })

  // The way back is where the reader armed it: cancelling calls nothing.
  it("disarms without removing when cancelled", async () => {
    renderChapter()
    fireEvent.click(
      screen.getByRole("button", {
        name: editor.removeLabel.replace("{name}", KNOWLEDGE_DEPTH),
      })
    )
    await screen.findByRole("button", { name: editor.removeConfirm })
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.model.change.cancel,
      })
    )
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: editor.removeConfirm })
      ).toBeNull()
    })
    expect(deactivateCriterion).not.toHaveBeenCalled()
  })

  // The section is uncapped, so the columns divide the whole page width. The
  // two states must divide it identically: one GRID_CLASS constant feeds both,
  // and this is what fails if a second grid string ever appears.
  it("lays the loading and loaded grids out with the same classes", () => {
    // Selected on the chapter grid's OWN breakpoint class, not on a bare
    // "grid-cols": the status Alert above carries a grid-cols of its own
    // (alertVariants' has-[>svg]:grid-cols-[auto_1fr]) and would be matched
    // first, which made this compare the Alert with itself.
    const gridOf = (root: HTMLElement) =>
      root.querySelector('[class*="sm:grid-cols-2"]')?.className
    const { container: loaded } = renderChapter()
    const loadedGrid = gridOf(loaded)
    expect(loadedGrid).toBeDefined()
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
    // The four dimensions are already on screen, in the same grid: what is
    // missing is only the data.
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)
    ).toEqual(DIMENSIONS.map((dimension) => dimension.name))
    // The add control's label is static i18n text, so it renders as itself
    // rather than as a gray bar; it is inert because whether the dimension has
    // room is exactly the unknown.
    const adds = screen.getAllByRole("button", { name: criteria.addCta })
    expect(adds).toHaveLength(4)
    expect(
      adds.every((add) => add.className.includes("pointer-events-none"))
    ).toBe(true)
  })
})
