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
const removeCriterionMock = vi.fn()
const addCriterionMock = vi.fn()
const noopMutation = vi.fn()

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: (ref: unknown) => {
    if (ref === "evaluationModel.criteria.rebalanceWeights")
      return rebalanceWeightsMock
    if (ref === "evaluationModel.criteria.removeCriterion")
      return removeCriterionMock
    if (ref === "evaluationModel.criteria.addCriterion") return addCriterionMock
    return noopMutation
  },
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    evaluationModel: {
      model: { getModel: "evaluationModel.model.getModel" },
      criteria: {
        rebalanceWeights: "evaluationModel.criteria.rebalanceWeights",
        removeCriterion: "evaluationModel.criteria.removeCriterion",
        addCriterion: "evaluationModel.criteria.addCriterion",
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

const editor = messages.dashboard.model.editor
const builder = messages.dashboard.model.builder

// Five balanced criteria (sum 15 = 5 x 3); c1 carries 4 points.
const model = {
  modelId: "model-1",
  name: "Standard",
  templateKey: "standard",
  criteria: [
    {
      criterionId: "c1",
      name: "Problem solving",
      description: "How the role breaks down and resolves hard problems.",
      helpText: "The extended description of how the role frames problems.",
      weightPoints: 4,
      order: 1,
      isCustom: false,
      anchors: [
        { level: 0, text: "none" },
        { level: 1, text: "a" },
        { level: 2, text: "b" },
        { level: 3, text: "c" },
        { level: 4, text: "d" },
        { level: 5, text: "max" },
      ],
    },
    {
      criterionId: "c2",
      name: "Autonomy",
      description: "Independence.",
      helpText: "",
      weightPoints: 2,
      order: 2,
      isCustom: false,
      anchors: [],
    },
    {
      criterionId: "c3",
      name: "Collaboration",
      description: "Across teams.",
      helpText: "",
      weightPoints: 3,
      order: 3,
      isCustom: false,
      anchors: [],
    },
    {
      criterionId: "c4",
      name: "Knowledge depth",
      description: "Expertise.",
      helpText: "",
      weightPoints: 3,
      order: 4,
      isCustom: false,
      anchors: [],
    },
    {
      criterionId: "c5",
      name: "Risk awareness",
      description: "Risk.",
      helpText: "",
      weightPoints: 3,
      order: 5,
      isCustom: false,
      anchors: [],
    },
  ],
  tracks: [],
  bandThresholds: [{ band: 1, minScore: 100 }],
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
    removeCriterionMock.mockReset()
    addCriterionMock.mockReset()
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

  it("Define phase: criteria + descriptions, no weighting", () => {
    renderBuilder("define", { removalFloor: 5 })
    expect(screen.getByText("Problem solving")).toBeDefined()
    expect(
      screen.getByText("How the role breaks down and resolves hard problems.")
    ).toBeDefined()
    // The Add action lives in the page header (like "Add role"), not the
    // builder itself.
    expect(screen.queryByRole("button", { name: editor.addCta })).toBeNull()
    // The extended description sits behind the morph help button next to the
    // name, whose accessible name is the criterion name (c1 has helpText); a
    // criterion without helpText (c2) has no help trigger.
    expect(
      screen.getByRole("button", { name: "Problem solving" })
    ).toBeDefined()
    expect(screen.queryByRole("button", { name: "Autonomy" })).toBeNull()
    // No weighting on Define: no share, no Save, no budget meter.
    expect(screen.queryByText(/26\.7%/)).toBeNull()
    expect(screen.queryByRole("button", { name: editor.saveCta })).toBeNull()
    expect(screen.queryByText(editor.balanced)).toBeNull()
  })

  it("Weight phase: budget alert, 1-5 scale, share, Save; no Add", () => {
    renderBuilder("weight", { withAiReview: true })
    // Budget status alert (balanced) and the atomic save; no Add control.
    expect(screen.getByText(editor.balanced)).toBeDefined()
    expect(screen.getByRole("button", { name: editor.saveCta })).toBeDefined()
    expect(screen.queryByRole("button", { name: editor.addCta })).toBeNull()
    // c1 (4 of 15) shows its share with the labelled suffix.
    expect(screen.getByText(/26\.7%/)).toBeDefined()
    expect(screen.getAllByText(builder.shareOfTotal).length).toBeGreaterThan(0)
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

  it("Define phase: Remove confirms then calls removeCriterion", async () => {
    removeCriterionMock.mockResolvedValue(undefined)
    renderBuilder("define")
    const trigger = screen.getByRole("button", {
      name: editor.rowMenuLabel.replace("{name}", "Problem solving"),
    })
    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole("menuitem", { name: editor.removeCta }))
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: editor.removeConfirm,
      })
    )
    await waitFor(() => {
      expect(removeCriterionMock).toHaveBeenCalledWith({
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
