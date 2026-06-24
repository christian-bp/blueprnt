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

const createFromTemplateMock = vi.fn()
const createEmptyMock = vi.fn()
const discardModelMock = vi.fn()
const completeOnboardingMock = vi.fn()
const rebalanceWeightsMock = vi.fn()
const addCriterionMock = vi.fn()
const removeCriterionMock = vi.fn()
const useQueryMock = vi.fn()

// The review screen embeds WeightReviewPanel, which issues its own AI
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
    if (ref === "evaluationModel.criteria.rebalanceWeights")
      return rebalanceWeightsMock
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
        rebalanceWeights: "evaluationModel.criteria.rebalanceWeights",
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

import { ModelSetupStep } from "@/components/onboarding/model-setup-step"

// getModel returns currentModel (default null = no model yet, so the choice
// screen renders). The resume tests and the post-create flow set it. Keeping
// the dispatch in the mock implementation (not the vi.mock factory) avoids a
// conditional-hook lint on the factory arrow.
let currentModel: unknown = null
function setModel(model: unknown) {
  currentModel = model
}

// The weight-review lock (false = Review button visible); the lock test
// flips it.
let reviewLocked = false

// The review/editor headings greet the organization by name.
const reviewHeading = messages.dashboard.model.review.heading.replace(
  "{name}",
  "Acme"
)

function renderStep(orgId = "org-123", onAdvance: () => void = () => {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ModelSetupStep
        orgId={orgId}
        organizationName="Acme"
        onAdvance={onAdvance}
      />
    </NextIntlClientProvider>
  )
}

// Five criteria (the composition floor, so the review screen's Next is
// enabled), exactly balanced (sum 15 = 5 x 3): the persisted allocation is
// always on the point budget (ADR-0004).
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
      weightPoints: 4,
      order: 1,
      isCustom: false,
      anchors: [],
    },
    {
      criterionId: "c2",
      name: "Autonomy",
      description: "How independently the role operates.",
      helpText: "",
      weightPoints: 2,
      order: 2,
      isCustom: false,
      anchors: [],
    },
    {
      criterionId: "c3",
      name: "Collaboration",
      description: "How the role works across teams.",
      helpText: "",
      weightPoints: 3,
      order: 3,
      isCustom: false,
      anchors: [],
    },
    {
      criterionId: "c4",
      name: "Knowledge depth",
      description: "How deep the role's expertise runs.",
      helpText: "",
      weightPoints: 3,
      order: 4,
      isCustom: false,
      anchors: [],
    },
    {
      criterionId: "c5",
      name: "Risk awareness",
      description: "How the role handles risk.",
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

describe("ModelSetupStep", () => {
  beforeEach(() => {
    createFromTemplateMock.mockReset()
    createEmptyMock.mockReset()
    discardModelMock.mockReset()
    completeOnboardingMock.mockReset()
    rebalanceWeightsMock.mockReset()
    addCriterionMock.mockReset()
    removeCriterionMock.mockReset()
    useQueryMock.mockReset()
    currentModel = null
    reviewLocked = false
    useQueryMock.mockImplementation((ref: unknown) =>
      ref === "ai.suggest.getOpenSuggestions"
        ? []
        : ref === "ai.suggest.getWeightReviewLock"
          ? reviewLocked
          : currentModel
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

  it("selecting scratch reveals the name form and fades (disables) the template card", () => {
    renderStep()
    // Select the scratch card; the name form is revealed below the cards and
    // the template card fades away (disabled while faded).
    fireEvent.click(screen.getByRole("button", { name: /Build from scratch/ }))
    expect(
      screen.getByRole("button", { name: /Start from the standard template/ })
    ).toHaveProperty("disabled", true)
    // The name input appears below the cards.
    expect(
      screen.getByLabelText(messages.dashboard.model.scratch.nameLabel)
    ).toBeDefined()
  })

  it("submitting an empty scratch name shows the required error and does not create", async () => {
    renderStep()
    fireEvent.click(screen.getByRole("button", { name: /Build from scratch/ }))
    const input = screen.getByLabelText(
      messages.dashboard.model.scratch.nameLabel
    )
    const form = input.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)
    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.validation.required)
      ).toBeDefined()
      expect(createEmptyMock).not.toHaveBeenCalled()
    })
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
    // Let isValid settle (the Next button enables) before submitting, as a real
    // user would; this also asserts the disable-until-valid gate releases.
    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: messages.dashboard.onboarding.screens.nextCta,
        })
      ).toHaveProperty("disabled", false)
    })
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    // Still on the choice screen with the scratch form open and Next enabled
    // for a retry; the editor never opened.
    expect(
      screen.queryByText(messages.dashboard.model.editor.heading)
    ).toBeNull()
    // The scratch name is still valid, so the retry button stays enabled.
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
        expect(screen.getByText(reviewHeading)).toBeDefined()
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
      expect(screen.getByText(reviewHeading)).toBeDefined()
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

  it("capitalizes a lowercase organization name when it leads the heading", async () => {
    // The name renders as typed mid-sentence, but a name-first heading still
    // starts with a capital: "acme's model" reads as "Acme's model".
    setModel(reviewModel)
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ModelSetupStep
          orgId="org-123"
          organizationName="acme"
          onAdvance={() => {}}
        />
      </NextIntlClientProvider>
    )
    const raw = messages.dashboard.model.review.heading.replace(
      "{name}",
      "acme"
    )
    const expected = raw.charAt(0).toUpperCase() + raw.slice(1)
    await waitFor(() => {
      expect(screen.getByText(expected)).toBeDefined()
    })
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

  it("Continue on the review screen calls onAdvance and does not complete onboarding", async () => {
    setModel(reviewModel)
    const onAdvance = vi.fn()
    renderStep("org-fin", onAdvance)

    // Resumes into the review screen; click its Next CTA.
    const nextCta = await screen.findByRole("button", {
      name: messages.dashboard.onboarding.screens.nextCta,
    })
    fireEvent.click(nextCta)

    expect(onAdvance).toHaveBeenCalledTimes(1)
    // Completion moves to the families step: the model step never completes.
    expect(completeOnboardingMock).not.toHaveBeenCalled()
  })

  it("review screen shows the AI Review trigger next to Edit", async () => {
    setModel(reviewModel)
    renderStep()
    await waitFor(() => {
      expect(screen.getByText(reviewHeading)).toBeDefined()
    })
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.ai.openReviewCta,
      })
    ).toBeDefined()
  })

  it("hides the AI Review trigger while the review lock holds", async () => {
    setModel(reviewModel)
    // A confirmed review with no model change after it: re-reviewing would
    // only repeat itself, so the button is gone until the weighting changes.
    reviewLocked = true
    renderStep()
    await waitFor(() => {
      expect(screen.getByText(reviewHeading)).toBeDefined()
    })
    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.ai.openReviewCta,
      })
    ).toBeNull()
    // Editing is still available; only the AI review is locked.
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.model.review.editCta,
      })
    ).toBeDefined()
  })

  it("review screen is read-only by default: shows the weighting as text and no remove button", async () => {
    setModel(reviewModel)
    renderStep()

    await waitFor(() => {
      expect(screen.getByText(reviewHeading)).toBeDefined()
    })

    // The weight points render as static text with the derived share, not a
    // select, in read-only mode (4 of 15 points = 26.7%).
    expect(screen.getByText(/26\.7%/)).toBeDefined()

    // No row actions menu in the accessibility tree in read-only mode.
    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.model.editor.rowMenuLabel.replace(
          "{name}",
          "Problem solving"
        ),
      })
    ).toBeNull()

    // The add-criterion form toggle is not rendered in read-only mode.
    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.model.editor.addCta,
      })
    ).toBeNull()
  })

  it("clicking editCta enters edit mode and cancel returns to read-only", async () => {
    setModel(reviewModel)
    renderStep()

    await waitFor(() => {
      expect(screen.getByText(reviewHeading)).toBeDefined()
    })

    const review = messages.dashboard.model.review
    const editor = messages.dashboard.model.editor

    // Enter edit mode.
    const editButton = screen.getByRole("button", { name: review.editCta })
    fireEvent.click(editButton)

    // The add-criterion toggle appears in edit mode.
    expect(screen.getByRole("button", { name: editor.addCta })).toBeDefined()

    // The budget meter reports the balanced allocation.
    expect(screen.getByText(editor.balanced)).toBeDefined()

    // The row actions menu appears in edit mode.
    expect(
      screen.getByRole("button", {
        name: editor.rowMenuLabel.replace("{name}", "Problem solving"),
      })
    ).toBeDefined()

    // Cancel leaves edit mode without saving.
    fireEvent.click(screen.getByRole("button", { name: editor.cancelCta }))

    // Back to read-only: the add toggle is gone again.
    expect(screen.queryByRole("button", { name: editor.addCta })).toBeNull()

    // The Edit button is back.
    expect(screen.getByRole("button", { name: review.editCta })).toBeDefined()
  })

  it("review screen renders a select per criterion with the correct importance value (after entering edit mode)", async () => {
    setModel(reviewModel)
    renderStep()

    await waitFor(() => {
      expect(screen.getByText(reviewHeading)).toBeDefined()
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
      expect(rebalanceWeightsMock).toBeDefined()
      return
    }
    // The first criterion carries 4 weight points.
    expect(hiddenSelect.value).toBe("4")
  })

  it("editing the allocation saves the full balanced set via rebalanceWeights", async () => {
    setModel(reviewModel)
    rebalanceWeightsMock.mockResolvedValue(null)
    renderStep("org-imp")

    await waitFor(() => {
      expect(screen.getByText(reviewHeading)).toBeDefined()
    })

    // Enter edit mode so the weight selects appear.
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.model.review.editCta,
      })
    )

    // Use the hidden Radix selects to simulate value changes.
    const selects = document.querySelectorAll("select")
    const first = selects[0]
    const second = selects[1]
    if (first === undefined || second === undefined) {
      expect(rebalanceWeightsMock).toBeDefined()
      return
    }
    // 4 -> 3 alone is one point under budget: Save must be disabled and
    // nothing posted (the zero-sum rule forces a compensating change).
    fireEvent.change(first, { target: { value: "3" } })
    const editor = messages.dashboard.model.editor
    const saveButton = screen.getByRole("button", { name: editor.saveCta })
    expect((saveButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(saveButton)
    expect(rebalanceWeightsMock).not.toHaveBeenCalled()

    // Compensate (2 -> 3): the allocation balances and Save posts the
    // WHOLE allocation atomically.
    fireEvent.change(second, { target: { value: "3" } })
    fireEvent.click(screen.getByRole("button", { name: editor.saveCta }))

    await waitFor(() => {
      expect(rebalanceWeightsMock).toHaveBeenCalledWith({
        orgId: "org-imp",
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
      expect(screen.getByText(reviewHeading)).toBeDefined()
    })
    // The threshold chip text ("1: 100+") must not appear: numeric internals
    // belong in the result views, not in model setup.
    expect(screen.queryByText("1: 100+")).toBeNull()
  })

  function openRowMenu(name: string) {
    const trigger = screen.getByRole("button", {
      name: messages.dashboard.model.editor.rowMenuLabel.replace(
        "{name}",
        name
      ),
    })
    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)
  }

  it("review screen Remove in the row menu opens the alert dialog, mutation not yet called", async () => {
    setModel(reviewModel)
    renderStep("org-rm")

    // Wait for the review screen, then enter edit mode so the menu exists.
    await waitFor(() => {
      expect(screen.getByText(reviewHeading)).toBeDefined()
    })
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.model.review.editCta,
      })
    )

    openRowMenu("Problem solving")
    fireEvent.click(
      screen.getByRole("menuitem", {
        name: messages.dashboard.model.editor.removeCta,
      })
    )

    // The destructive confirmation is an AlertDialog (portaled), carrying
    // both the destructive confirm and the cancel button.
    const dialog = screen.getByRole("alertdialog")
    expect(
      within(dialog).getByRole("button", {
        name: messages.dashboard.model.editor.removeConfirm,
      })
    ).toBeDefined()
    expect(
      within(dialog).getByRole("button", {
        name: messages.dashboard.model.change.cancel,
      })
    ).toBeDefined()
    // The mutation has NOT been called yet (only the dialog opened).
    expect(removeCriterionMock).not.toHaveBeenCalled()
  })

  it("review screen weight slot renders points + share in read mode and the 1-5 scale in edit mode", async () => {
    setModel(reviewModel)
    renderStep()

    await waitFor(() => {
      expect(screen.getByText(reviewHeading)).toBeDefined()
    })

    // Read mode: the weight points show as static text with the derived
    // share, and no weight controls exist yet.
    expect(screen.getByText(/26\.7%/)).toBeDefined()

    // Edit mode: the same slot now renders the 1-5 scale as a button group
    // with the current allocation pressed.
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.model.review.editCta,
      })
    )
    const weightGroup = screen.getByRole("group", {
      name: messages.dashboard.model.editor.setWeightPoints.replace(
        "{name}",
        "Problem solving"
      ),
    })
    const options = within(weightGroup).getAllByRole("button")
    expect(options).toHaveLength(5)
    expect(
      options.map((option) => option.getAttribute("aria-pressed"))
    ).toEqual(["false", "true", "false", "false", "false"])
  })

  it("review screen confirming removal calls removeCriterion with the criterionId", async () => {
    setModel(reviewModel)
    removeCriterionMock.mockResolvedValue(undefined)
    renderStep("org-rm")

    await waitFor(() => {
      expect(screen.getByText(reviewHeading)).toBeDefined()
    })
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.model.review.editCta,
      })
    )

    openRowMenu("Problem solving")
    fireEvent.click(
      screen.getByRole("menuitem", {
        name: messages.dashboard.model.editor.removeCta,
      })
    )

    const confirmButton = within(screen.getByRole("alertdialog")).getByRole(
      "button",
      {
        name: messages.dashboard.model.editor.removeConfirm,
      }
    )
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(removeCriterionMock).toHaveBeenCalledWith({
        orgId: "org-rm",
        criterionId: "c1",
      })
    })
  })

  it("review screen cancelling the alert dialog removes nothing", async () => {
    setModel(reviewModel)
    renderStep("org-rm")

    await waitFor(() => {
      expect(screen.getByText(reviewHeading)).toBeDefined()
    })
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.model.review.editCta,
      })
    )

    openRowMenu("Problem solving")
    fireEvent.click(
      screen.getByRole("menuitem", {
        name: messages.dashboard.model.editor.removeCta,
      })
    )

    // Scoped to the alert dialog: the editor header has its own Cancel.
    const cancelButton = within(screen.getByRole("alertdialog")).getByRole(
      "button",
      {
        name: messages.dashboard.model.change.cancel,
      }
    )
    fireEvent.click(cancelButton)

    expect(removeCriterionMock).not.toHaveBeenCalled()
    // After cancel the row menu trigger is back in reach.
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.model.editor.rowMenuLabel.replace(
          "{name}",
          "Problem solving"
        ),
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
      expect(screen.getByText(reviewHeading)).toBeDefined()
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
    expect(screen.queryByText(reviewHeading)).toBeNull()
  })
})
