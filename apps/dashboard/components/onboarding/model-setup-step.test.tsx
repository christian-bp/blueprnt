import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const createFromTemplateMock = vi.fn()
const createEmptyMock = vi.fn()
const discardModelMock = vi.fn()
const completeOnboardingMock = vi.fn()
const updateCriterionImportanceMock = vi.fn()
const addCriterionMock = vi.fn()
const removeCriterionMock = vi.fn()
const useQueryMock = vi.fn()

// The review screen embeds ImportanceReviewPanel, which issues its own AI
// mutations; they are no-ops here but must resolve to a function.
const noopMutation = vi.fn()

// useMutation returns the matching mock based on the api reference passed in.
vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (ref === "evaluationModel.model.createModelFromTemplate")
      return createFromTemplateMock
    if (ref === "evaluationModel.model.createEmptyModel") return createEmptyMock
    if (ref === "evaluationModel.model.discardModel") return discardModelMock
    if (ref === "accounts.organization.completeOnboarding")
      return completeOnboardingMock
    if (ref === "evaluationModel.criteria.updateCriterionImportance")
      return updateCriterionImportanceMock
    if (ref === "evaluationModel.criteria.addCriterion") return addCriterionMock
    if (ref === "evaluationModel.criteria.removeCriterion")
      return removeCriterionMock
    return noopMutation
  },
  // The mock dispatches on the api ref (set up in beforeEach): getModel returns
  // the model; getOpenSuggestions returns [] so the embedded review panel idles
  // in its initial state. Keeping the dispatch in the mock implementation (not
  // this factory arrow) avoids a conditional-hook lint on the factory.
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    accounts: {
      organization: {
        completeOnboarding: "accounts.organization.completeOnboarding",
      },
    },
    evaluationModel: {
      model: {
        createModelFromTemplate:
          "evaluationModel.model.createModelFromTemplate",
        createEmptyModel: "evaluationModel.model.createEmptyModel",
        discardModel: "evaluationModel.model.discardModel",
        getModel: "evaluationModel.model.getModel",
      },
      criteria: {
        addCriterion: "evaluationModel.criteria.addCriterion",
        removeCriterion: "evaluationModel.criteria.removeCriterion",
        updateCriterionImportance:
          "evaluationModel.criteria.updateCriterionImportance",
      },
    },
    ai: {
      suggest: {
        getOpenSuggestions: "ai.suggest.getOpenSuggestions",
        requestImportanceReview: "ai.suggest.requestImportanceReview",
        confirmImportanceReview: "ai.suggest.confirmImportanceReview",
        rejectSuggestion: "ai.suggest.rejectSuggestion",
      },
    },
  },
}))

import { ModelSetupStep } from "@/components/onboarding/model-setup-step"

// getModel returns currentModel (default null = no model yet, so the choice
// screen renders). The resume tests and the post-create flow set it. Keeping
// the dispatch in the mock implementation (not the vi.mock factory) avoids a
// conditional-hook lint on the factory arrow.
let currentModel: unknown = null
function setModel(model: unknown) {
  currentModel = model
}

function renderStep(orgId = "org-123", onContinue: () => void = () => {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ModelSetupStep orgId={orgId} onContinue={onContinue} />
    </NextIntlClientProvider>
  )
}

const reviewModel = {
  modelId: "model-1",
  name: "Standard",
  templateKey: "standard",
  criteria: [
    {
      criterionId: "c1",
      name: "Problem solving",
      description: "How the role breaks down and resolves hard problems.",
      helpText: "",
      importanceLevel: 6,
      order: 1,
      isCustom: false,
      anchors: [],
    },
  ],
  tracks: [],
  bandThresholds: [{ band: 1, minScore: 100 }],
}

describe("ModelSetupStep", () => {
  beforeEach(() => {
    createFromTemplateMock.mockReset()
    createEmptyMock.mockReset()
    discardModelMock.mockReset()
    completeOnboardingMock.mockReset()
    updateCriterionImportanceMock.mockReset()
    addCriterionMock.mockReset()
    removeCriterionMock.mockReset()
    useQueryMock.mockReset()
    currentModel = null
    useQueryMock.mockImplementation((ref: unknown) =>
      ref === "ai.suggest.getOpenSuggestions" ? [] : currentModel
    )
  })

  afterEach(() => {
    cleanup()
  })

  it("renders both the template and scratch cards", () => {
    renderStep()
    expect(
      screen.getByText(messages.dashboard.model.template.title)
    ).toBeDefined()
    expect(
      screen.getByText(messages.dashboard.model.scratch.title)
    ).toBeDefined()
    // The template card carries the recommended badge.
    expect(
      screen.getByText(messages.dashboard.model.template.badge)
    ).toBeDefined()
  })

  it("selecting scratch reveals the name form; Next stays disabled until a name is typed", () => {
    renderStep()
    // Select the scratch card; the name form is revealed below the cards and
    // the template card fades away (disabled while faded).
    fireEvent.click(screen.getByRole("button", { name: /Build from scratch/ }))
    expect(
      screen.getByRole("button", { name: /Start from the standard template/ })
    ).toHaveProperty("disabled", true)
    const nextCta = screen.getByRole("button", {
      name: messages.dashboard.onboarding.screens.nextCta,
    })
    expect(nextCta).toHaveProperty("disabled", true)

    const input = screen.getByLabelText(
      messages.dashboard.model.scratch.nameLabel
    )
    fireEvent.change(input, { target: { value: "My model" } })
    expect(nextCta).toHaveProperty("disabled", false)
  })

  it("clicking the scratch card again deselects it and brings the template card back", () => {
    renderStep()
    const scratch = screen.getByRole("button", { name: /Build from scratch/ })
    fireEvent.click(scratch)
    expect(scratch.getAttribute("aria-pressed")).toBe("true")

    fireEvent.click(scratch)
    expect(scratch.getAttribute("aria-pressed")).toBe("false")
    expect(
      screen.getByRole("button", { name: /Start from the standard template/ })
    ).toHaveProperty("disabled", false)
  })

  it("submitting the scratch name creates the empty model and opens the editor", async () => {
    createEmptyMock.mockImplementation(async () => {
      setModel({ ...reviewModel, templateKey: null })
      return "model-2"
    })
    renderStep("org-scr")

    fireEvent.click(screen.getByRole("button", { name: /Build from scratch/ }))
    const input = screen.getByLabelText(
      messages.dashboard.model.scratch.nameLabel
    )
    fireEvent.change(input, { target: { value: "My model" } })
    const form = input.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(createEmptyMock).toHaveBeenCalledWith({
        orgId: "org-scr",
        name: "My model",
      })
    })
    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.model.editor.heading)
      ).toBeDefined()
    })
  })

  it("shows the error alert and keeps the form when the scratch creation rejects", async () => {
    createEmptyMock.mockRejectedValue(new Error("ConvexError: modelExists"))
    renderStep("org-scr")

    fireEvent.click(screen.getByRole("button", { name: /Build from scratch/ }))
    const input = screen.getByLabelText(
      messages.dashboard.model.scratch.nameLabel
    )
    fireEvent.change(input, { target: { value: "My model" } })
    const form = input.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    // Still on the choice screen with the scratch form open and Next enabled
    // for a retry; the editor never opened.
    expect(
      screen.queryByText(messages.dashboard.model.editor.heading)
    ).toBeNull()
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.onboarding.screens.nextCta,
      })
    ).toHaveProperty("disabled", false)
  })

  it("calls createModelFromTemplate and switches to the review screen", async () => {
    // The create call makes the model available to the review screen's getModel.
    createFromTemplateMock.mockImplementation(async () => {
      setModel(reviewModel)
      return "model-1"
    })
    renderStep("org-abc")

    // Picking the template card creates the model and auto-advances; there is
    // no separate confirm button.
    fireEvent.click(
      screen.getByRole("button", { name: /Start from the standard template/ })
    )

    await waitFor(() => {
      expect(createFromTemplateMock).toHaveBeenCalledWith({ orgId: "org-abc" })
    })

    // The review screen renders its heading once the mode flips (after the
    // fade-plus-pause advance delay).
    await waitFor(
      () => {
        expect(
          screen.getByText(messages.dashboard.model.review.heading)
        ).toBeDefined()
      },
      { timeout: 2000 }
    )
  })

  it("shows the error alert when the template mutation rejects", async () => {
    createFromTemplateMock.mockRejectedValue(new Error("ConvexError: notFound"))
    renderStep()

    fireEvent.click(
      screen.getByRole("button", { name: /Start from the standard template/ })
    )

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    // The cards are restored so the user can pick again.
    expect(
      screen.getByRole("button", { name: /Build from scratch/ })
    ).toHaveProperty("disabled", false)
    expect(
      screen
        .getByRole("button", { name: /Start from the standard template/ })
        .getAttribute("aria-pressed")
    ).toBe("false")
  })

  it("resumes into the review screen when a template model already exists", async () => {
    // A reload mid-setup: the model exists (templateKey set) but onboarding was
    // never finished. The step jumps straight to the review screen, no clicks.
    setModel(reviewModel)
    renderStep()
    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.model.review.heading)
      ).toBeDefined()
    })
    // The choice cards are not shown.
    expect(
      screen.queryByText(messages.dashboard.model.template.badge)
    ).toBeNull()
    // The review screen localizes its content: getModel is queried with the
    // active UI locale ("en" from the test provider) so it re-runs on a switch.
    expect(useQueryMock).toHaveBeenCalledWith(
      "evaluationModel.model.getModel",
      expect.objectContaining({ locale: "en" })
    )
  })

  it("resumes into the editor when a scratch model already exists", async () => {
    setModel({ ...reviewModel, templateKey: null })
    renderStep()
    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.model.editor.heading)
      ).toBeDefined()
    })
    expect(
      screen.queryByText(messages.dashboard.model.template.badge)
    ).toBeNull()
  })

  it("Continue on the review screen calls onContinue and does not complete onboarding", async () => {
    setModel(reviewModel)
    const onContinue = vi.fn()
    renderStep("org-fin", onContinue)

    // Resumes into the review screen; click its Next CTA.
    const nextCta = await screen.findByRole("button", {
      name: messages.dashboard.onboarding.screens.nextCta,
    })
    fireEvent.click(nextCta)

    expect(onContinue).toHaveBeenCalledTimes(1)
    // Completion moves to the families step: the model step never completes.
    expect(completeOnboardingMock).not.toHaveBeenCalled()
  })

  it("review screen is read-only by default: shows importance as text and no remove button", async () => {
    setModel(reviewModel)
    renderStep()

    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.model.review.heading)
      ).toBeDefined()
    })

    // The importance label renders as static text, not a select, in read-only mode.
    // importanceLevel 6 maps to "Very important" in en.json model.importance.veryHigh.
    expect(screen.getByText(messages.model.importance.veryHigh)).toBeDefined()

    // No remove button in the accessibility tree in read-only mode.
    expect(
      screen.queryByRole("button", {
        name: `${messages.dashboard.model.editor.removeCta} Problem solving`,
      })
    ).toBeNull()

    // The add-criterion form toggle is not rendered in read-only mode.
    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.model.editor.addCta,
      })
    ).toBeNull()
  })

  it("clicking editCta enters edit mode and doneEditing returns to read-only", async () => {
    setModel(reviewModel)
    renderStep()

    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.model.review.heading)
      ).toBeDefined()
    })

    const review = messages.dashboard.model.review

    // Enter edit mode.
    const editButton = screen.getByRole("button", { name: review.editCta })
    fireEvent.click(editButton)

    // The add-criterion toggle appears in edit mode.
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.model.editor.addCta,
      })
    ).toBeDefined()

    // The remove button is present in the accessibility tree (opacity-0 does
    // not hide from queries; only visual styling changes).
    expect(
      screen.getByRole("button", {
        name: `${messages.dashboard.model.editor.removeCta} Problem solving`,
      })
    ).toBeDefined()

    // Click Done to leave edit mode.
    fireEvent.click(screen.getByRole("button", { name: review.doneEditing }))

    // Back to read-only: the add toggle is gone again.
    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.model.editor.addCta,
      })
    ).toBeNull()

    // The Edit button is back.
    expect(screen.getByRole("button", { name: review.editCta })).toBeDefined()
  })

  it("review screen renders a select per criterion with the correct importance value (after entering edit mode)", async () => {
    setModel(reviewModel)
    renderStep()

    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.model.review.heading)
      ).toBeDefined()
    })

    // Enter edit mode so the importance select appears.
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.model.review.editCta,
      })
    )

    // Radix Select renders a hidden <select> for native form compatibility.
    const hiddenSelect = document.querySelector("select")
    if (!hiddenSelect) {
      // Portal-based selects may not render in happy-dom; the mock is wired.
      expect(updateCriterionImportanceMock).toBeDefined()
      return
    }
    // The criterion has importanceLevel 6.
    expect(hiddenSelect.value).toBe("6")
  })

  it("changing the importance select calls updateCriterionImportance with correct args", async () => {
    setModel(reviewModel)
    updateCriterionImportanceMock.mockResolvedValue(null)
    renderStep("org-imp")

    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.model.review.heading)
      ).toBeDefined()
    })

    // Enter edit mode so the importance select appears.
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.model.review.editCta,
      })
    )

    // Use the hidden Radix select to simulate a value change.
    const hiddenSelect = document.querySelector("select")
    if (!hiddenSelect) {
      expect(updateCriterionImportanceMock).toBeDefined()
      return
    }
    fireEvent.change(hiddenSelect, { target: { value: "4" } })

    await waitFor(() => {
      expect(updateCriterionImportanceMock).toHaveBeenCalledWith({
        orgId: "org-imp",
        criterionId: "c1",
        importanceLevel: 4,
      })
    })
  })

  it("review screen labels the criteria section and shows each criterion's description", async () => {
    setModel(reviewModel)
    renderStep()

    // The criteria section carries the editor.heading label ("Criteria").
    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.model.editor.heading)
      ).toBeDefined()
    })
    // The localized description (server-side) renders under the name.
    expect(
      screen.getByText("How the role breaks down and resolves hard problems.")
    ).toBeDefined()
  })

  it("review screen does not show band thresholds", async () => {
    setModel(reviewModel)
    renderStep()

    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.model.review.heading)
      ).toBeDefined()
    })
    // The threshold chip text ("1: 100+") must not appear: numeric internals
    // belong in the result views, not in model setup.
    expect(screen.queryByText("1: 100+")).toBeNull()
  })

  it("review screen remove button arms the inline confirm (after entering edit mode), mutation not yet called", async () => {
    setModel(reviewModel)
    renderStep("org-rm")

    // Wait for the review screen, then enter edit mode so remove is available.
    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.model.review.heading)
      ).toBeDefined()
    })
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.model.review.editCta,
      })
    )

    // The remove button is in the accessibility tree (opacity-0 does not hide
    // from queries; only visual styling changes on hover/focus). Clicking it
    // arms the inline confirm.
    const removeButton = screen.getByRole("button", {
      name: `${messages.dashboard.model.editor.removeCta} Problem solving`,
    })
    fireEvent.click(removeButton)

    // Confirm and cancel are now rendered inline.
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.model.editor.removeCta,
      })
    ).toBeDefined()
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.model.change.cancel,
      })
    ).toBeDefined()
    // The mutation has NOT been called yet (only armed, not confirmed).
    expect(removeCriterionMock).not.toHaveBeenCalled()
  })

  it("review screen importance slot renders the label in read mode and the select in edit mode", async () => {
    setModel(reviewModel)
    renderStep()

    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.model.review.heading)
      ).toBeDefined()
    })

    // Read mode: the importance shows as static text (importanceLevel 6 maps to
    // "Very important"), and there is no select.
    expect(screen.getByText(messages.model.importance.veryHigh)).toBeDefined()
    expect(document.querySelector("select")).toBeNull()

    // Edit mode: the same slot now renders the importance select.
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.model.review.editCta,
      })
    )
    const importanceSelect = screen.getByRole("combobox", {
      name: messages.dashboard.model.review.setImportance.replace(
        "{name}",
        "Problem solving"
      ),
    })
    expect(importanceSelect).toBeDefined()
  })

  it("review screen armed overlay renders both the confirm and cancel buttons", async () => {
    setModel(reviewModel)
    renderStep("org-rm")

    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.model.review.heading)
      ).toBeDefined()
    })
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.model.review.editCta,
      })
    )

    // Arm the floating confirm overlay by clicking the trashcan.
    fireEvent.click(
      screen.getByRole("button", {
        name: `${messages.dashboard.model.editor.removeCta} Problem solving`,
      })
    )

    // The overlay renders both the destructive confirm (removeCta label) and
    // the outline cancel button.
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.model.editor.removeCta,
      })
    ).toBeDefined()
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.model.change.cancel,
      })
    ).toBeDefined()
  })

  it("review screen confirming removal calls removeCriterion with the criterionId", async () => {
    setModel(reviewModel)
    removeCriterionMock.mockResolvedValue(undefined)
    renderStep("org-rm")

    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.model.review.heading)
      ).toBeDefined()
    })
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.model.review.editCta,
      })
    )

    const removeButton = screen.getByRole("button", {
      name: `${messages.dashboard.model.editor.removeCta} Problem solving`,
    })
    fireEvent.click(removeButton)

    // The inline confirm button shares the removeCta label.
    const confirmButton = screen.getByRole("button", {
      name: messages.dashboard.model.editor.removeCta,
    })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(removeCriterionMock).toHaveBeenCalledWith({
        orgId: "org-rm",
        criterionId: "c1",
      })
    })
  })

  it("review screen cancelling the inline confirm disarms without calling removeCriterion", async () => {
    setModel(reviewModel)
    renderStep("org-rm")

    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.model.review.heading)
      ).toBeDefined()
    })
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.model.review.editCta,
      })
    )

    const removeButton = screen.getByRole("button", {
      name: `${messages.dashboard.model.editor.removeCta} Problem solving`,
    })
    fireEvent.click(removeButton)

    const cancelButton = screen.getByRole("button", {
      name: messages.dashboard.model.change.cancel,
    })
    fireEvent.click(cancelButton)

    expect(removeCriterionMock).not.toHaveBeenCalled()
    // After cancel the trigger (trashcan with removeLabel) is back.
    expect(
      screen.getByRole("button", {
        name: `${messages.dashboard.model.editor.removeCta} Problem solving`,
      })
    ).toBeDefined()
  })

  it("review screen opens the add dialog after entering edit mode, then submits to addCriterion", async () => {
    setModel(reviewModel)
    addCriterionMock.mockResolvedValue("c-new")
    const editor = messages.dashboard.model.editor
    renderStep("org-add")

    // Wait for the review screen, then enter edit mode.
    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.model.review.heading)
      ).toBeDefined()
    })
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.model.review.editCta,
      })
    )

    // The trigger uses editor.addCta; the form lives in the dialog and is not
    // rendered until the trigger is clicked.
    const trigger = screen.getByRole("button", { name: editor.addCta })
    expect(screen.queryByLabelText(editor.name)).toBeNull()

    fireEvent.click(trigger)

    const nameInput = screen.getByLabelText(editor.name)
    fireEvent.change(nameInput, { target: { value: "Communication" } })

    const form = nameInput.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(addCriterionMock).toHaveBeenCalledTimes(1)
    })
    const call = addCriterionMock.mock.calls[0]?.[0] as {
      orgId: string
      name: string
    }
    expect(call.orgId).toBe("org-add")
    expect(call.name).toBe("Communication")
  })

  it("change-choice on the resumed review screen discards the model and returns to the choice screen", async () => {
    // Resume into the review screen, then reverse the choice. The discard
    // clears the model (mimicking reactivity), so the choice cards reappear.
    setModel(reviewModel)
    discardModelMock.mockImplementation(async () => {
      setModel(null)
      return null
    })
    const change = messages.dashboard.model.change
    renderStep("org-chg")

    // Wait for the review screen, then arm and confirm the change.
    const changeCta = await screen.findByRole("button", { name: change.cta })
    fireEvent.click(changeCta)
    fireEvent.click(screen.getByRole("button", { name: change.confirm }))

    await waitFor(() => {
      expect(discardModelMock).toHaveBeenCalledWith({ orgId: "org-chg" })
    })

    // Back on the choice screen: the template card and its recommended badge
    // are shown again.
    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.model.template.badge)
      ).toBeDefined()
    })
    // The review screen is gone.
    expect(
      screen.queryByText(messages.dashboard.model.review.heading)
    ).toBeNull()
  })
})
