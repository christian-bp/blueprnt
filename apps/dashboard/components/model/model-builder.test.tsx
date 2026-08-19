import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const useQueryMock = vi.fn()
const rebalanceWeightsMock = vi.fn()
const deactivateCriterionMock = vi.fn()
const activateCriterionMock = vi.fn()
const noopMutation = vi.fn()

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: (ref: unknown) => {
    if (ref === "evaluationModel.criteria.rebalanceWeights")
      return rebalanceWeightsMock
    if (ref === "evaluationModel.criteria.deactivateCriterion")
      return deactivateCriterionMock
    if (ref === "evaluationModel.criteria.activateCriterion")
      return activateCriterionMock
    return noopMutation
  },
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    evaluationModel: {
      model: { getModel: "evaluationModel.model.getModel" },
      criteria: {
        rebalanceWeights: "evaluationModel.criteria.rebalanceWeights",
        deactivateCriterion: "evaluationModel.criteria.deactivateCriterion",
        activateCriterion: "evaluationModel.criteria.activateCriterion",
      },
    },
    ai: {
      suggest: {
        getOpenSuggestions: "ai.suggest.getOpenSuggestions",
        getWeightReviewLock: "ai.suggest.getWeightReviewLock",
        requestWeightReview: "ai.suggest.requestWeightReview",
        confirmWeightReview: "ai.suggest.confirmWeightReview",
        rejectSuggestion: "ai.suggest.rejectSuggestion",
      },
    },
  },
}))

import { ModelBuilder } from "@/components/model/model-builder"
import { openMenu } from "@/test/menu"

const editor = messages.dashboard.model.editor
const builder = messages.dashboard.model.builder
const picker = messages.dashboard.model.picker

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

// Five balanced criteria (sum 15 = 5 x 3); c1 carries 4 points. Spread across
// three of the four dimensions so grouping is exercised; the fourth
// (workingConditions) stays empty to exercise the empty-section copy.
const model = {
  modelId: "model-1",
  name: "Standard",
  approval: null,
  workingConditions: null,
  criteria: [
    criterion({
      criterionId: "c1",
      libraryKey: "complexity-ambiguity",
      dimensionKey: "effort",
      name: "Problem solving",
      shortUiText: "How the role breaks down and resolves hard problems.",
      fullDefinition:
        "The extended description of how the role frames problems.",
      weightPoints: 4,
      order: 1,
      anchors: [
        { step: 0, text: "none" },
        { step: 1, text: "a" },
        { step: 2, text: "b" },
        { step: 3, text: "c" },
        { step: 4, text: "d" },
        { step: 5, text: "max" },
      ],
    }),
    criterion({
      criterionId: "c2",
      libraryKey: "autonomy-mandate",
      dimensionKey: "responsibility",
      name: "Autonomy",
      shortUiText: "Independence.",
      weightPoints: 2,
      order: 2,
    }),
    criterion({
      criterionId: "c3",
      libraryKey: "communication-effort",
      dimensionKey: "effort",
      name: "Collaboration",
      shortUiText: "Across teams.",
      weightPoints: 3,
      order: 3,
    }),
    criterion({
      criterionId: "c4",
      libraryKey: "knowledge-depth",
      dimensionKey: "competence",
      name: "Knowledge depth",
      shortUiText: "Expertise.",
      weightPoints: 3,
      order: 4,
    }),
    criterion({
      criterionId: "c5",
      libraryKey: "risk-consequence",
      dimensionKey: "responsibility",
      name: "Risk awareness",
      shortUiText: "Risk.",
      weightPoints: 3,
      order: 5,
    }),
  ],
  sharedScale: [],
  midpoints: { step2: "", step4: "" },
  dimensions: [
    {
      key: "competence",
      name: "Competence",
      question: "q",
      why: "Why competence.",
    },
    { key: "effort", name: "Effort", question: "q", why: "Why effort." },
    {
      key: "responsibility",
      name: "Responsibility",
      question: "q",
      why: "Why responsibility.",
    },
    {
      key: "workingConditions",
      name: "Working conditions",
      question: "q",
      why: "Why working conditions.",
    },
  ],
  tracks: [],
  levelRules: [{ level: 1, minScore: 100 }],
  zoneProfileRules: [],
}

let reviewLocked = false
function renderBuilder(
  phase: "define" | "weight",
  props: Record<string, unknown> = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ModelBuilder orgId="org-1" phase={phase} {...props} />
    </NextIntlClientProvider>
  )
}

describe("ModelBuilder", () => {
  beforeEach(() => {
    useQueryMock.mockReset()
    rebalanceWeightsMock.mockReset()
    deactivateCriterionMock.mockReset()
    activateCriterionMock.mockReset()
    reviewLocked = false
    useQueryMock.mockImplementation((ref: unknown) =>
      ref === "ai.suggest.getOpenSuggestions"
        ? []
        : ref === "ai.suggest.getWeightReviewLock"
          ? reviewLocked
          : model
    )
  })
  afterEach(() => cleanup())

  it("Define phase: dimension sections group criteria, no weighting", () => {
    renderBuilder("define")
    // Every dimension heading renders, including the empty one.
    expect(screen.getByText("Competence")).toBeDefined()
    expect(screen.getByText("Effort")).toBeDefined()
    expect(screen.getByText("Responsibility")).toBeDefined()
    expect(screen.getByText("Working conditions")).toBeDefined()
    expect(screen.getByText(editor.emptyDimension)).toBeDefined()

    expect(screen.getByText("Problem solving")).toBeDefined()
    expect(
      screen.getByText("How the role breaks down and resolves hard problems.")
    ).toBeDefined()
    // The extended description sits behind a morph help icon next to the name,
    // titled by the criterion name (c1 has fullDefinition); a criterion
    // without one (c2) has no help icon.
    expect(
      screen.getByRole("button", { name: "Problem solving" })
    ).toBeDefined()
    expect(screen.queryByRole("button", { name: "Autonomy" })).toBeNull()
    // A library picker trigger per dimension section (4 sections).
    expect(screen.getAllByRole("button", { name: picker.addCta })).toHaveLength(
      4
    )
    // No weighting on Define: no share, no Save, no budget meter.
    expect(screen.queryByText(/26\.7%/)).toBeNull()
    expect(screen.queryByRole("button", { name: editor.saveCta })).toBeNull()
    expect(screen.queryByText(editor.balanced)).toBeNull()
  })

  it("Weight phase: budget alert, 1-5 scale, share, Save; no picker", () => {
    renderBuilder("weight", { withAiReview: true })
    // Budget status alert (balanced) and the atomic save; no picker trigger.
    expect(screen.getByText(editor.balanced)).toBeDefined()
    expect(screen.getByRole("button", { name: editor.saveCta })).toBeDefined()
    expect(screen.queryByRole("button", { name: picker.addCta })).toBeNull()
    // c1 (4 of 15) shows its share with the labelled suffix.
    expect(screen.getByText(/26\.7%/)).toBeDefined()
    expect(screen.getAllByText(builder.shareOfTotal).length).toBeGreaterThan(0)
    // The morph help icon is on the weight page too (c1 has fullDefinition).
    expect(
      screen.getByRole("button", { name: "Problem solving" })
    ).toBeDefined()
    // The 1-5 control (options 5..1) with the current allocation (4) pressed.
    const group = screen.getByRole("group", {
      name: editor.setWeightPoints.replace("{name}", "Problem solving"),
    })
    const options = within(group).getAllByRole("button")
    expect(options).toHaveLength(5)
    expect(options.map((o) => o.getAttribute("aria-pressed"))).toEqual([
      "false",
      "true",
      "false",
      "false",
      "false",
    ])
    // AI review trigger is offered on a saved (not dirty) allocation.
    expect(
      screen.getByRole("button", { name: messages.dashboard.ai.openReviewCta })
    ).toBeDefined()
  })

  it("Weight phase: editing saves the full balanced allocation", async () => {
    rebalanceWeightsMock.mockResolvedValue(null)
    renderBuilder("weight")
    const groupFor = (name: string) =>
      screen.getByRole("group", {
        name: editor.setWeightPoints.replace("{name}", name),
      })
    // c1 4 -> 3 alone is under budget: Save disabled, nothing posted.
    fireEvent.click(
      within(groupFor("Problem solving")).getByRole("button", { name: "3" })
    )
    const save = screen.getByRole("button", { name: editor.saveCta })
    expect((save as HTMLButtonElement).disabled).toBe(true)
    // Compensate c2 2 -> 3: balanced, Save posts the whole allocation.
    fireEvent.click(
      within(groupFor("Autonomy")).getByRole("button", { name: "3" })
    )
    fireEvent.click(screen.getByRole("button", { name: editor.saveCta }))
    await waitFor(() => {
      expect(rebalanceWeightsMock).toHaveBeenCalledWith({
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

  it("Define phase: Remove confirms then calls deactivateCriterion", async () => {
    deactivateCriterionMock.mockResolvedValue(undefined)
    renderBuilder("define")
    await openMenu(
      screen.getByRole("button", {
        name: editor.rowMenuLabel.replace("{name}", "Problem solving"),
      })
    )
    fireEvent.click(screen.getByRole("menuitem", { name: editor.removeCta }))
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: editor.removeConfirm,
      })
    )
    await waitFor(() => {
      expect(deactivateCriterionMock).toHaveBeenCalledWith({
        orgId: "org-1",
        criterionId: "c1",
      })
    })
  })

  it("Weight phase: hides the AI review trigger while the lock holds", () => {
    reviewLocked = true
    renderBuilder("weight", { withAiReview: true })
    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.ai.openReviewCta,
      })
    ).toBeNull()
    expect(screen.getByRole("button", { name: editor.saveCta })).toBeDefined()
  })
})
