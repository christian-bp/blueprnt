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

// The fourth column's materiality decision is an adminMutation, so the column
// asks who is looking. Everything else on the chapter is role-blind.
let orgRole = "admin"
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: orgRole }),
}))

import { CHAPTER_GRID_CLASS } from "@/components/model/chapter-grid"
import { criteriaLibraryContent } from "@workspace/backend/convex/evaluationModel/criteriaLibrary"
import { CriteriaChapter } from "@/components/model/criteria-chapter"
import {
  modelChapterProgress,
  type ModelProgressInput,
} from "@/lib/model-chapters"
import { toast } from "@/lib/toast"
import { mockMutation, onQuery } from "@/test/convex-mocks"

const criteria = messages.dashboard.model.criteria
const wc = criteria.workingConditions
const help = messages.dashboard.help
const picker = messages.dashboard.model.picker
const editor = messages.dashboard.model.editor
const weighting = messages.dashboard.model.weighting

const activateCriterion = mockMutation(
  "evaluationModel.criteria.activateCriterion"
)
const deactivateCriterion = mockMutation(
  "evaluationModel.criteria.deactivateCriterion"
)
const setWorkingConditionsDecision = mockMutation(
  "evaluationModel.approval.setWorkingConditionsDecision"
)

// The four dimensions exactly as getModel serves them (localized library
// content, ADR-0021: fixed method law).
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

// The library's own names for the keys the tests reach for, so an assertion
// reads the same string the surface renders from the library module.
const KNOWLEDGE_DEPTH = "Knowledge depth and specialist level"
const KNOWLEDGE_BREADTH =
  "Knowledge breadth and cross-disciplinary understanding"
// The library's own one-liner and full definition for knowledge-breadth, so
// the assertions read the same strings the picker renders from the library
// module: the one-liner on the collapsed face, the definition behind the
// press.
const KNOWLEDGE_BREADTH_SHORT =
  criteriaLibraryContent("en").criteria["knowledge-breadth"].shortUiText
const KNOWLEDGE_BREADTH_FULL =
  "Captures the role's requirement to combine and integrate several competence areas, such as product, data, business and technology, and to understand how they connect. It measures breadth of integration, not the number of people the role works with."
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

// The recorded materiality decision, exactly as getModel serves it (decidedBy
// is the raw auth id on the wire, which no surface renders).
interface Decision {
  status: "active" | "testedNotMaterial"
  motivation: string
  decidedBy: string
  decidedAt: number
}

function makeModel(
  entries: ReturnType<typeof criterion>[],
  workingConditions: Decision | null = null
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

const SAFETY = "Safety and exposure conditions"

// The fourth column's four states, as the model query serves them.
//
// (a) a working-conditions criterion chosen: the dimension is material and the
// column shows the card. The decision is recorded as active alongside it,
// which is what the approval gate's own check asks for.
const WC_ACTIVE = makeModel(
  [
    ...SELECTION.criteria,
    criterion({
      criterionId: "c9",
      libraryKey: "safety-exposure",
      dimensionKey: "workingConditions",
      name: SAFETY,
      order: 3,
    }),
  ],
  {
    status: "active",
    motivation: "Field crews work under protective measures year round.",
    decidedBy: "auth-1",
    decidedAt: Date.UTC(2026, 2, 4),
  }
)

// (b) tested and found NOT material: the dimension is settled, holds nothing,
// and is waiting for nothing.
const WC_SETTLED = makeModel(SELECTION.criteria, {
  status: "testedNotMaterial",
  motivation: "No role carries a lasting special working condition.",
  decidedBy: "auth-1",
  decidedAt: Date.UTC(2026, 2, 4),
})

// (c) is SELECTION itself: nothing chosen in the dimension and nothing
// decided about it.
//
// (d) decided ACTIVE with nothing chosen: what removing the criterion leaves
// behind. The decision is deliberately not deleted with it (a swap under the
// one-criterion cap passes through this state, and flipping it the other way
// would need a motivation no system can author), so the column is
// decided-but-unstaffed rather than undecided.
const WC_ACTIVE_UNSTAFFED = makeModel(SELECTION.criteria, {
  status: "active",
  motivation: "Field crews work under protective measures year round.",
  decidedBy: "auth-1",
  decidedAt: Date.UTC(2026, 2, 4),
})

let modelResult: unknown = SELECTION
let industryResult: string | null = "itTelecom"

// The engine's verdict on the selection, as getMethodChecks serves it. Only
// the three blocker checks this chapter reads are built; the pill's rule is
// the engine's, so the fixture states check RESULTS rather than a criteria
// list the test would have to re-derive them from.
function selectionChecks({
  count,
  uncovered = [],
  materialityDecided = true,
  capsOk = true,
}: {
  count: number
  uncovered?: string[]
  materialityDecided?: boolean
  capsOk?: boolean
}) {
  return {
    checks: [
      { key: "dimensionCaps", level: "blocker", ok: capsOk },
      {
        key: "criterionCount",
        level: "blocker",
        ok: count >= 6 && count <= 8,
        count,
      },
      {
        key: "dimensionCoverage",
        level: "blocker",
        ok: uncovered.length === 0,
        ...(uncovered.length > 0 ? { dimensions: uncovered } : {}),
      },
      {
        key: "workingConditionsTested",
        level: "blocker",
        ok: materialityDecided,
      },
    ],
    approval: null,
    lastApprovedAt: null,
    workingConditions: null,
    dimensionShares: [],
  }
}

// Undefined by default: the chapter's own tests are about the columns, and a
// pill needs the checks to have landed before it says anything.
let checksResult: unknown

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
    setWorkingConditionsDecision.mockReset().mockResolvedValue(null)
    vi.mocked(toast.success).mockReset()
    activateCriterion.mockResolvedValue("c9")
    deactivateCriterion.mockResolvedValue(null)
    orgRole = "admin"
    modelResult = SELECTION
    industryResult = "itTelecom"
    checksResult = undefined
    onQuery((ref) => {
      if (ref === "evaluationModel.model.getModel") return modelResult
      if (ref === "accounts.organization.getOrganizationSettings") {
        return { orgId: "org-1", industry: industryResult }
      }
      if (ref === "evaluationModel.approval.getMethodChecks")
        return checksResult
      return undefined
    })
  })
  afterEach(() => cleanup())

  it("shows every dimension as a column holding its own chosen criteria", () => {
    const { container } = renderChapter()
    for (const dimension of DIMENSIONS) {
      expect(column(dimension.name)).toBeDefined()
    }
    // In the one shared frame every chapter draws its dimensions in, so a
    // tweak to the box lands on all three at once.
    expect(
      container.querySelectorAll('[data-slot="dimension-frame"]')
    ).toHaveLength(DIMENSIONS.length)
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
  // What remains, in one sentence, floating clear of the columns. The rule is
  // the ENGINE's: the pill reads the same checks the Godkännande checklist
  // reports and the same modelChapterProgress derivation the spine's own
  // segment moves on, so the three surfaces can never disagree about whether
  // this chapter is done.
  describe("the remaining-step pill", () => {
    const pill = () =>
      document.querySelector(
        '[data-slot="floating-pill"]'
      ) as HTMLElement | null
    const sentence = (
      key: "remainingDimension" | "remainingMateriality",
      values: Record<string, string> = {}
    ) => {
      let text: string = criteria[key]
      for (const [name, value] of Object.entries(values)) {
        text = text.replace(`{${name}}`, value)
      }
      return text
    }

    it("says how many criteria are still missing under the minimum", () => {
      checksResult = selectionChecks({ count: 4 })
      renderChapter()
      // Six is the work, so four selected leaves two.
      expect(pill()?.textContent).toContain("2 more criteria")
    })

    it("says it in the singular when one is missing", () => {
      checksResult = selectionChecks({ count: 5 })
      renderChapter()
      expect(pill()?.textContent).toContain("1 more criterion")
    })

    // The count is met and the coverage is not: the pill names the dimension
    // the engine itself reports as uncovered, never one this test worked out.
    it("names an uncovered mandatory dimension once the count is met", () => {
      checksResult = selectionChecks({ count: 6, uncovered: ["effort"] })
      renderChapter()
      expect(pill()?.textContent).toBe(
        sentence("remainingDimension", { dimension: "Effort and complexity" })
      )
    })

    it("asks for the materiality decision once count and coverage are met", () => {
      checksResult = selectionChecks({ count: 6, materialityDecided: false })
      renderChapter()
      expect(pill()?.textContent).toBe(sentence("remainingMateriality"))
    })

    // Complete by its own rule: nothing to say, so nothing on screen.
    it("says nothing once the chapter is complete", () => {
      checksResult = selectionChecks({ count: 6 })
      renderChapter()
      expect(pill()).toBeNull()
    })

    // A dimension over its own cap leaves the chapter incomplete, and the pill
    // deliberately says nothing: the column holding the extra criterion states
    // its count against its cap in its own chip, and the picker refuses to add
    // past it. Recorded here because it is a CHOICE, not an oversight (and the
    // state is unreachable through today's write paths at all).
    it("says nothing about a dimension over its cap, which its column carries", () => {
      const checks = selectionChecks({ count: 6, capsOk: false })
      checksResult = checks
      // The state is genuinely incomplete by the chapter's own rule, so the
      // silence below is the pill choosing not to speak rather than the
      // chapter being finished. Without this the test would pass vacuously if
      // dimensionCaps ever left the chapter's station checks.
      const progress = modelChapterProgress(
        {
          // The fixture states check results as the wire carries them; the
          // derivation wants its own narrower slice of the same rows.
          checks: checks.checks as ModelProgressInput["checks"],
          approved: false,
          weightsSaved: false,
        },
        "criteria"
      )
      expect(progress.done).toBeLessThan(progress.total)
      renderChapter()
      expect(pill()).toBeNull()
    })

    // A sentence read from a check list that has not arrived would tell a
    // finished model to choose six criteria.
    it("says nothing while the checks are still loading", () => {
      checksResult = undefined
      renderChapter()
      expect(pill()).toBeNull()
    })

    // Purely informative: adding a criterion is instant and per column, so
    // there is no batch action for this pill to carry.
    it("offers no control", () => {
      checksResult = selectionChecks({ count: 4 })
      renderChapter()
      expect(pill()?.querySelector("button")).toBeNull()
      // The ordinary working state, never a warning.
      expect(pill()?.getAttribute("data-tone")).toBe("info")
    })
  })

  it("carries no weight row and no evaluation scale", () => {
    renderChapter()
    expect(screen.queryAllByRole("group")).toHaveLength(0)
    expect(
      screen.queryByText(
        new RegExp(
          weighting.shareOfWeight.replace("<share></share>", "").trim()
        )
      )
    ).toBeNull()
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

  // A warning about nothing is noise. physical-sensory declares an overlap
  // (with safety-exposure), but that criterion is not in this model, so the
  // row carries no overlap chip at all while analytical-effort, whose
  // counterpart IS chosen, does.
  it("warns only about overlaps with criteria the model already has", async () => {
    renderChapter()
    await openPicker("Effort and complexity")
    const dialog = screen.getByRole("dialog")
    const quiet = within(dialog)
      .getByText("Physical or sensory effort")
      .closest("li") as HTMLElement
    expect(quiet.textContent).not.toContain(
      criteria.overlapChip.replace("{names}", "")
    )
    const warned = within(dialog)
      .getByText(ANALYTICAL)
      .closest("li") as HTMLElement
    expect(warned.textContent).toContain(
      criteria.overlapChip.replace("{names}", COMPLEXITY)
    )
  })

  // The list is a comparison, so the collapsed face stays scannable: name,
  // one line, chips. Everything the decision needs is one press away, which
  // the next tests cover.
  it("leads a picker row with the one-liner, not the full definition", async () => {
    renderChapter()
    await openPicker("Competence")
    const row = within(screen.getByRole("dialog"))
      .getByText(KNOWLEDGE_BREADTH)
      .closest("li") as HTMLElement
    expect(within(row).getByText(KNOWLEDGE_BREADTH_SHORT)).toBeDefined()
    expect(within(row).queryByText(KNOWLEDGE_BREADTH_FULL)).toBeNull()
  })

  // The one-liner must never clip: line-clamp-none overrides
  // ItemDescription's own two-line clamp, asserted against the vendor base
  // the same way the title's is, below.
  it("lets a picker row's one-liner wrap rather than clamping it", async () => {
    renderChapter()
    await openPicker("Competence")
    const description = within(screen.getByRole("dialog")).getByText(
      KNOWLEDGE_BREADTH_SHORT
    )
    expect(description.className).toContain("line-clamp-none")
    expect(description.className).not.toContain("line-clamp-2")
  })

  // Masterdokument 11: the decision material is the full definition, where the
  // criterion fits and where it does not, and the control question. All of it
  // is reachable from the picker, one press per row.
  it("opens a picker row's decision material: definition, fit, and the control question", async () => {
    renderChapter()
    await openPicker("Competence")
    const dialog = screen.getByRole("dialog")
    const row = within(dialog)
      .getByText(KNOWLEDGE_BREADTH)
      .closest("li") as HTMLElement
    const entry = criteriaLibraryContent("en").criteria["knowledge-breadth"]

    fireEvent.click(within(row).getByText(picker.detailToggle))

    expect(within(row).getByText(entry.fullDefinition)).toBeDefined()
    expect(within(row).getByText(entry.whenSuitable)).toBeDefined()
    expect(within(row).getByText(entry.whenNotSuitable)).toBeDefined()
    expect(row.textContent).toContain(entry.controlQuestion)
    expect(row.textContent).toContain(picker.suitableLabel)
    expect(row.textContent).toContain(picker.notSuitableLabel)
    expect(row.textContent).toContain(picker.controlQuestionLabel)
  })

  // Deviation 6 stands: the control question is answered in the reader's own
  // head, so it brings no field and no gate with it. Activation is one press,
  // before and after opening the detail.
  it("asks the control question without gating the add behind it", async () => {
    renderChapter()
    await openPicker("Competence")
    const row = within(screen.getByRole("dialog"))
      .getByText(KNOWLEDGE_BREADTH)
      .closest("li") as HTMLElement
    const add = within(row).getByRole("button", {
      name: picker.addRowLabel.replace("{name}", KNOWLEDGE_BREADTH),
    })
    // Enabled before the question has even been read: reading it is the
    // reader's own business, not a step the surface makes them complete.
    expect(add.hasAttribute("disabled")).toBe(false)

    fireEvent.click(within(row).getByText(picker.detailToggle))
    expect(within(row).queryByRole("checkbox")).toBeNull()
    expect(within(row).queryByRole("textbox")).toBeNull()
    expect(add.hasAttribute("disabled")).toBe(false)
    fireEvent.click(add)
    await waitFor(() => {
      expect(activateCriterion).toHaveBeenCalledWith({
        orgId: "org-1",
        libraryKey: "knowledge-breadth",
      })
    })
  })

  it("states the dimension's cap in the picker, in the column's own words", async () => {
    renderChapter()
    await openPicker("Competence")
    // One competence criterion is already chosen in the fixture, of a cap of 2.
    expect(
      within(screen.getByRole("dialog")).getByText(
        criteria.columnCount.replace("{count}", "1").replace("{max}", "2")
      )
    ).toBeDefined()
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

  // A full dimension simply loses its add row: no disabled control, and no
  // sentence explaining the cap. The count chip and the dimension's help carry
  // it instead; no prose renders.
  it("drops a full dimension's add row, silently", () => {
    modelResult = COMPETENCE_FULL
    renderChapter()
    expect(column("Competence").dataset.full).toBe("true")
    expect(
      screen.queryByRole("button", {
        name: criteria.addLabel.replace("{dimension}", "Competence"),
      })
    ).toBeNull()
    // The chip carries the state, filled in.
    expect(
      within(column("Competence")).getByText(
        criteria.columnCount.replace("{count}", "2").replace("{max}", "2")
      ).dataset.variant
    ).toBe("secondary")
    // A dimension with room still offers its picker, in its own column.
    expect(column("Effort and complexity").dataset.full).toBe("false")
    const add = addButton("Effort and complexity")
    expect(column("Effort and complexity").contains(add)).toBe(true)
  })

  // The per-dimension caps sum to exactly the model's own ceiling of 8, so a
  // full model is always four full dimensions and every column loses its row.
  it("leaves no add row anywhere once the model is full", () => {
    modelResult = MODEL_FULL
    renderChapter()
    for (const dimension of DIMENSIONS) {
      expect(column(dimension.name).dataset.full).toBe("true")
    }
    // Not one add control anywhere on the chapter.
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
      expect(deactivateCriterion).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: "org-1",
          criterionId: "c4",
        })
      )
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

  // The dimension's help says what the dimension COVERS, with the criteria it
  // is for. The library's guiding question ("q4" in this fixture) is not what
  // a column shows: a heading with a question behind it left the reader to
  // answer it themselves.
  it("explains each dimension by what it covers", () => {
    renderChapter()
    const triggers = screen.getAllByRole("button", {
      name: help.dimensionLabel,
    })
    expect(triggers).toHaveLength(4)
    fireEvent.click(
      within(column("Working conditions")).getByRole("button", {
        name: help.dimensionLabel,
      })
    )
    expect(screen.getByText(help.dimensionWorkingConditionsBody)).toBeDefined()
    // The library's own question for each dimension, which this column
    // deliberately does not ask: the heading says what the dimension COVERS,
    // and the help beside it answers rather than asks. Read from the library
    // content rather than from a fixture field, because the wire stopped
    // carrying the question at all and the text still exists there.
    const library = criteriaLibraryContent("en")
    for (const dimension of DIMENSIONS) {
      const key = dimension.key as keyof typeof library.dimensions
      expect(screen.queryByText(library.dimensions[key].question)).toBeNull()
    }
  })

  // QUESTION FIRST. The column asks the materiality question outright and
  // offers two equal answers, and the criterion slot does not exist until one
  // of them says it should: the coupling between "material" and "a criterion
  // belongs here" is the structure of the surface rather than a sentence about
  // it. Every state below is that machine.
  describe("the working conditions column", () => {
    const wcColumn = () => column("Working conditions")
    const addRow = () =>
      within(wcColumn()).queryByRole("button", {
        name: criteria.addLabel.replace("{dimension}", "Working conditions"),
      })
    const hatch = () =>
      within(wcColumn()).queryByRole("img", { name: criteria.columnEmpty })
    const answer = (name: string) =>
      within(wcColumn()).queryByRole("button", { name })
    // Formatted here the way the surface formats it, so the assertion cannot
    // drift with the runtime's own time zone.
    const decidedOn = (at: number) =>
      wc.decidedOn.replace(
        "{date}",
        new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
          new Date(at)
        )
      )

    // (1) UNDECIDED. The question is the empty state's content: no hatch, no
    // add row, and no separate call to action, because there is nothing to add
    // to until the question is answered.
    it("asks the materiality question, with two equal answers and no slot", () => {
      renderChapter()
      const col = wcColumn()
      expect(within(col).getByText(wc.materialityQuestion)).toBeDefined()
      expect(answer(wc.yesCta)).not.toBeNull()
      expect(answer(wc.noCta)).not.toBeNull()
      // Neither answer is dressed as the expected one.
      expect(answer(wc.yesCta)?.className).toBe(answer(wc.noCta)?.className)
      // The reassurance the question raises, answered in place.
      expect(within(col).getByText(wc.noCriterionHint)).toBeDefined()
      // No slot, and no way to reach the picker.
      expect(hatch()).toBeNull()
      expect(addRow()).toBeNull()
    })

    // Which answer the form opened on, read off the toggle the form itself
    // pressed rather than off a class.
    const pressedInDialog = (label: string) =>
      within(screen.getByRole("dialog"))
        .getByRole("button", { name: label })
        .getAttribute("aria-pressed")

    // Answering opens the motivation step ON that answer: the column made the
    // decision, the dialog only takes its reason.
    it("opens the motivation step on the answer that was chosen", async () => {
      renderChapter()
      fireEvent.click(answer(wc.noCta) as HTMLElement)
      const dialog = await screen.findByRole("dialog")
      expect(within(dialog).getByText(wc.testHeading)).toBeDefined()
      expect(pressedInDialog(wc.testedNotMaterialOption)).toBe("true")
      expect(pressedInDialog(wc.activeOption)).toBe("false")

      const motivation = within(dialog).getByRole("textbox")
      fireEvent.change(motivation, {
        target: { value: "No role carries a lasting special condition." },
      })
      fireEvent.blur(motivation)
      const save = () =>
        within(screen.getByRole("dialog")).getByRole("button", {
          name: wc.saveCta,
        }) as HTMLButtonElement
      await waitFor(() => {
        expect(save().disabled).toBe(false)
      })
      fireEvent.click(save())
      await waitFor(() => {
        expect(setWorkingConditionsDecision).toHaveBeenCalledWith(
          expect.objectContaining({
            orgId: "org-1",
            status: "testedNotMaterial",
            motivation: "No role carries a lasting special condition.",
          })
        )
      })
      // Nothing completes silently, and the dialog gets out of the way of the
      // column it just settled.
      expect(vi.mocked(toast.success)).toHaveBeenCalled()
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull()
      })
    })

    it("opens the motivation step on the material answer too", async () => {
      renderChapter()
      fireEvent.click(answer(wc.yesCta) as HTMLElement)
      const dialog = await screen.findByRole("dialog")
      expect(pressedInDialog(wc.activeOption)).toBe("true")
      // Nothing to remove and nothing selected, so the offer stays off: it
      // belongs to the answer that collides with a chosen criterion.
      expect(
        within(dialog).queryByText(wc.removeOffer.replace("{name}", SAFETY))
      ).toBeNull()
      expect(
        within(dialog).queryByRole("button", { name: wc.removeAndSaveCta })
      ).toBeNull()
      const motivation = within(dialog).getByRole("textbox")
      fireEvent.change(motivation, {
        target: { value: "Standby duty is a recurring requirement." },
      })
      fireEvent.blur(motivation)
      await waitFor(() => {
        expect(
          (
            within(screen.getByRole("dialog")).getByRole("button", {
              name: wc.saveCta,
            }) as HTMLButtonElement
          ).disabled
        ).toBe(false)
      })
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: wc.saveCta,
        })
      )
      await waitFor(() => {
        expect(setWorkingConditionsDecision).toHaveBeenCalledWith(
          expect.objectContaining({
            orgId: "org-1",
            status: "active",
            motivation: "Standby duty is a recurring requirement.",
          })
        )
      })
    })

    // Answering "not material" while a criterion is selected is an OFFER, not
    // an errand. The old copy told the reader to leave, deactivate the
    // criterion themselves and come back; the system can make that round trip
    // for them, and the dialog names what it will do before it does it.
    it("offers to remove the criterion when the answer collides with it", async () => {
      modelResult = WC_ACTIVE
      renderChapter()
      fireEvent.click(
        within(wcColumn()).getByRole("button", { name: wc.changeCta })
      )
      const dialog = await screen.findByRole("dialog")
      fireEvent.click(
        within(dialog).getByRole("button", { name: wc.testedNotMaterialOption })
      )

      // Named, not counted: "a criterion is selected" is not something a
      // reader can weigh without knowing which one, and the consequence is
      // spelled out rather than left to the word "remove".
      expect(
        await within(dialog).findByText(
          wc.removeOffer.replace("{name}", SAFETY)
        )
      ).toBeDefined()
      // The button says both things it does, which is what carries the gravity
      // an AlertDialog would otherwise have to.
      const save = () =>
        within(screen.getByRole("dialog")).getByRole("button", {
          name: wc.removeAndSaveCta,
        }) as HTMLButtonElement
      expect(save()).toBeDefined()
      expect(
        within(dialog).queryByRole("button", { name: wc.saveCta })
      ).toBeNull()

      const motivation = within(dialog).getByRole("textbox")
      fireEvent.change(motivation, {
        target: { value: "Retested this year and found it not material." },
      })
      fireEvent.blur(motivation)
      await waitFor(() => {
        expect(save().disabled).toBe(false)
      })
      fireEvent.click(save())

      await waitFor(() => {
        expect(setWorkingConditionsDecision).toHaveBeenCalledWith(
          expect.objectContaining({
            orgId: "org-1",
            status: "testedNotMaterial",
            motivation: "Retested this year and found it not material.",
          })
        )
      })
      expect(deactivateCriterion).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: "org-1",
          criterionId: "c9",
        })
      )
      // Removal FIRST. The backend refuses the not-material decision while a
      // working-conditions criterion is active, so the other order can only
      // fail.
      expect(
        deactivateCriterion.mock.invocationCallOrder[0] as number
      ).toBeLessThan(
        setWorkingConditionsDecision.mock.invocationCallOrder[0] as number
      )
      // One answer to one question, so the two audit rows it writes share a
      // gesture id and read as one story in the log.
      const removalId = deactivateCriterion.mock.calls[0]?.[0]?.batchId
      const decisionId =
        setWorkingConditionsDecision.mock.calls[0]?.[0]?.batchId
      expect(typeof removalId).toBe("string")
      expect(removalId).toBe(decisionId)
    })

    // With nothing selected there is nothing to offer to remove, so the same
    // answer stays the plain save it has always been.
    it("keeps the plain save when the dimension holds nothing", async () => {
      modelResult = WC_ACTIVE_UNSTAFFED
      renderChapter()
      fireEvent.click(
        within(wcColumn()).getByRole("button", { name: wc.changeCta })
      )
      const dialog = await screen.findByRole("dialog")
      fireEvent.click(
        within(dialog).getByRole("button", { name: wc.testedNotMaterialOption })
      )
      expect(
        within(dialog).queryByRole("button", { name: wc.removeAndSaveCta })
      ).toBeNull()
      expect(
        within(dialog).getByRole("button", { name: wc.saveCta })
      ).toBeDefined()

      const motivation = within(dialog).getByRole("textbox")
      fireEvent.change(motivation, {
        target: { value: "Retested: not material." },
      })
      fireEvent.blur(motivation)
      const save = () =>
        within(screen.getByRole("dialog")).getByRole("button", {
          name: wc.saveCta,
        }) as HTMLButtonElement
      await waitFor(() => {
        expect(save().disabled).toBe(false)
      })
      fireEvent.click(save())
      await waitFor(() => {
        expect(setWorkingConditionsDecision).toHaveBeenCalledWith(
          expect.objectContaining({
            orgId: "org-1",
            status: "testedNotMaterial",
            motivation: "Retested: not material.",
          })
        )
      })
      expect(deactivateCriterion).not.toHaveBeenCalled()
    })

    // (2) MATERIAL, NOTHING CHOSEN. The answer opened the slot, so the column
    // becomes one, and it reads top down as decision, place, action: the
    // decision in a SENTENCE that names its own consequence, the empty slot it
    // explains, and the add row that fills it. A status word here would leave
    // a first-time reader, or a colleague who did not make the decision, with
    // an undecodable badge over a dashed box.
    it("becomes a slot once the answer is material, reading decision then slot then action", () => {
      modelResult = WC_ACTIVE_UNSTAFFED
      renderChapter()
      const col = wcColumn()
      const decided = within(col).getByText(wc.materialSlotLine)
      expect(
        within(col).getByRole("button", { name: wc.changeCta })
      ).toBeDefined()
      const slot = hatch()
      const add = addRow()
      expect(slot).not.toBeNull()
      expect(add).not.toBeNull()
      expect(
        decided.compareDocumentPosition(slot as HTMLElement) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
      expect(
        (slot as HTMLElement).compareDocumentPosition(add as HTMLElement) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
      // The question is answered, so it is off the surface with its
      // reassurance.
      expect(within(col).queryByText(wc.materialityQuestion)).toBeNull()
      expect(within(col).queryByText(wc.noCriterionHint)).toBeNull()
    })

    // Help sits after a TITLE, never floating beside body text or a control,
    // and a change affordance is part of the sentence it belongs to rather
    // than a grey row under it. Both together are what made this column read
    // as debris: an icon with nothing to be attached to, over an orphan line.
    it("keeps help on titles and the change inside the sentence", async () => {
      modelResult = WC_ACTIVE_UNSTAFFED
      renderChapter()
      const col = wcColumn()
      // The column's only help is the dimension title's own.
      expect(
        within(col).getAllByRole("button", { name: help.dimensionLabel })
      ).toHaveLength(1)
      expect(
        within(col).queryByRole("button", {
          name: help.workingConditionsDecisionLabel,
        })
      ).toBeNull()

      // The change affordance lives in the sentence's own paragraph.
      const line = within(col).getByText(wc.materialSlotLine)
      const change = within(col).getByRole("button", { name: wc.changeCta })
      expect(line.contains(change)).toBe(true)

      // The decision's own fact moved to the title of the step that decides
      // it, which is a title and therefore a place help belongs.
      fireEvent.click(change)
      const dialog = await screen.findByRole("dialog")
      expect(
        within(dialog).getByRole("button", {
          name: help.workingConditionsDecisionLabel,
        })
      ).toBeDefined()
    })

    // (3) NOT MATERIAL. The dimension is settled: the documented decision is
    // the column's content, and no slot ever opens. It reads cold because the
    // sentence above the motivation says who tested what, which is what gives
    // the motivation something to be the reason FOR.
    it("documents the decision and opens no slot when the answer is not material", () => {
      modelResult = WC_SETTLED
      renderChapter()
      const col = wcColumn()
      const line = within(col).getByText(wc.notMaterialLine)
      const motivation = within(col).getByText(
        "No role carries a lasting special working condition."
      )
      expect(
        line.compareDocumentPosition(motivation) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
      expect(
        within(col).getByText(decidedOn(Date.UTC(2026, 2, 4)))
      ).toBeDefined()
      expect(
        within(col).getByRole("button", { name: wc.changeCta })
      ).toBeDefined()
      expect(hatch()).toBeNull()
      expect(addRow()).toBeNull()
    })

    // (4) STAFFED. The card is the content and the decision is its footnote,
    // so here the order turns around: the criterion first, the line under it.
    // Shorter than the slot state's sentence, because the card above supplies
    // the context, but still a statement rather than a status word.
    it("shows the criterion with the decision compact beneath it", () => {
      modelResult = WC_ACTIVE
      renderChapter()
      const col = wcColumn()
      const card = within(col).getByText(SAFETY)
      const decided = within(col).getByText(wc.materialFootnote)
      // The slot state's fuller sentence is not repeated here.
      expect(within(col).queryByText(wc.materialSlotLine)).toBeNull()
      expect(
        card.compareDocumentPosition(decided) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
      // The slot is filled, and the dimension's cap of one takes the add row
      // with it.
      expect(hatch()).toBeNull()
      expect(addRow()).toBeNull()
      // The full motivation belongs to the not-material state, where it is the
      // dimension's whole evidence; here the criterion is.
      expect(
        within(col).queryByText(
          "Field crews work under protective measures year round."
        )
      ).toBeNull()
    })

    // (5) LEGACY. A criterion chosen with the question never answered, which
    // old data can still hold: the card stands, and the question comes with
    // it, because the approval gate needs the decision either way.
    it("keeps asking the question when a criterion is chosen but nothing is recorded", () => {
      modelResult = makeModel(WC_ACTIVE.criteria)
      renderChapter()
      const col = wcColumn()
      expect(within(col).getByText(SAFETY)).toBeDefined()
      expect(within(col).getByText(wc.materialityQuestion)).toBeDefined()
      expect(answer(wc.yesCta)).not.toBeNull()
      expect(answer(wc.noCta)).not.toBeNull()
      // "No criterion is needed" is not the fact this reader needs: they have
      // one.
      expect(within(col).queryByText(wc.noCriterionHint)).toBeNull()
    })

    // The structural coupling, stated once over every state that lacks an
    // active decision: the picker cannot be reached at all, so a criterion
    // can never arrive in a dimension nobody has called material.
    it("keeps the picker unreachable until the answer is material", () => {
      for (const model of [
        SELECTION,
        WC_SETTLED,
        makeModel(WC_ACTIVE.criteria),
      ]) {
        modelResult = model
        renderChapter()
        expect(addRow()).toBeNull()
        cleanup()
      }
      modelResult = WC_ACTIVE_UNSTAFFED
      renderChapter()
      expect(addRow()).not.toBeNull()
    })

    // The state the reader LANDS in after removing the criterion: the decision
    // survives (a swap under the one-criterion cap passes through this state,
    // and flipping it the other way would need a motivation no system can
    // author), so the column reopens as a slot rather than as the question.
    it("reopens the slot after the criterion is removed", async () => {
      modelResult = WC_ACTIVE
      const { rerender } = renderChapter()
      fireEvent.click(
        within(wcColumn()).getByRole("button", {
          name: editor.removeLabel.replace("{name}", SAFETY),
        })
      )
      fireEvent.click(
        await screen.findByRole("button", { name: editor.removeConfirm })
      )
      await waitFor(() => {
        expect(deactivateCriterion).toHaveBeenCalledWith(
          expect.objectContaining({
            orgId: "org-1",
            criterionId: "c9",
          })
        )
      })

      // The model a live query would serve next, handed to the same tree:
      // the seam a mocked query leaves.
      modelResult = WC_ACTIVE_UNSTAFFED
      rerender(
        <NextIntlClientProvider locale="en" messages={messages}>
          <CriteriaChapter orgId="org-1" />
        </NextIntlClientProvider>
      )
      const col = wcColumn()
      expect(within(col).queryByText(SAFETY)).toBeNull()
      // The slot state, in its own order: the decision the removal left
      // standing, then the place it reopened, then the way to fill it.
      const decided = within(col).getByText(wc.materialSlotLine)
      expect(hatch()).not.toBeNull()
      expect(addRow()).not.toBeNull()
      expect(
        decided.compareDocumentPosition(hatch() as HTMLElement) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
      // Never back to the question: the decision was not deleted with the
      // criterion.
      expect(within(col).queryByText(wc.materialityQuestion)).toBeNull()
    })

    // The materiality decision is member-level work: admin covers org
    // administration and the audit log, so an editor answers the question and
    // changes the answer exactly as an admin does.
    it("gives an editor the same question and the same controls", () => {
      orgRole = "editor"
      renderChapter()
      expect(within(wcColumn()).getByText(wc.materialityQuestion)).toBeDefined()
      expect(answer(wc.yesCta)).not.toBeNull()
      expect(answer(wc.noCta)).not.toBeNull()
      cleanup()

      modelResult = WC_SETTLED
      renderChapter()
      expect(within(wcColumn()).getByText(wc.notMaterialLine)).toBeDefined()
      expect(
        within(wcColumn()).getByRole("button", { name: wc.changeCta })
      ).toBeDefined()
    })

    // The other three dimensions carry no decision at all: it belongs to this
    // one, and a question on every column would read as four decisions.
    it("puts the question on no other dimension", () => {
      renderChapter()
      for (const name of [
        "Competence",
        "Effort and complexity",
        "Responsibility and impact",
      ]) {
        expect(
          within(column(name)).queryByText(wc.materialityQuestion)
        ).toBeNull()
      }
      expect(screen.getAllByText(wc.materialityQuestion)).toHaveLength(1)
    })
  })

  // The section is uncapped, so the columns divide the whole page width. Both
  // states, and the Viktning chapter's own grid, all read the one exported
  // CHAPTER_GRID_CLASS constant, and this is what fails if a second grid
  // string ever appears anywhere in the pair.
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
