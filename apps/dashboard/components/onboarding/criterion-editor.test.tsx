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

const addCriterionMock = vi.fn()
const removeCriterionMock = vi.fn()
const completeOnboardingMock = vi.fn()
const useQueryMock = vi.fn()

// The embedded ModelDraftPanel issues its own AI mutations; they are no-ops in
// these editor tests but must resolve to a function so the panel mounts.
const noopMutation = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (ref === "evaluationModel.criteria.addCriterion") return addCriterionMock
    if (ref === "evaluationModel.criteria.removeCriterion")
      return removeCriterionMock
    if (ref === "accounts.organization.completeOnboarding")
      return completeOnboardingMock
    return noopMutation
  },
  // The mock dispatches on the api ref (set up in beforeEach): getModel returns
  // the editor's model; getOpenSuggestions returns [] so the mounted draft panel
  // idles in its initial state.
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
      model: { getModel: "evaluationModel.model.getModel" },
      criteria: {
        addCriterion: "evaluationModel.criteria.addCriterion",
        removeCriterion: "evaluationModel.criteria.removeCriterion",
      },
    },
    ai: {
      suggest: {
        getOpenSuggestions: "ai.suggest.getOpenSuggestions",
        requestModelDraft: "ai.suggest.requestModelDraft",
        confirmModelDraft: "ai.suggest.confirmModelDraft",
        rejectSuggestion: "ai.suggest.rejectSuggestion",
      },
    },
  },
}))

import { CriterionEditor } from "@/components/onboarding/criterion-editor"

function emptyModel() {
  return {
    modelId: "model-1",
    name: "Custom",
    templateKey: null,
    criteria: [],
    tracks: [],
    bandThresholds: [],
  }
}

function modelWithCriterion() {
  return {
    ...emptyModel(),
    criteria: [
      {
        criterionId: "c1",
        name: "Autonomy",
        description: "",
        helpText: "",
        weightPoints: 3,
        order: 1,
        isCustom: true,
        anchors: [],
      },
    ],
  }
}

// A balanced model with `count` criteria, all at the neutral 3, for the
// composition-floor gate tests.
function modelWithCriteria(count: number) {
  return {
    ...emptyModel(),
    criteria: Array.from({ length: count }, (_, index) => ({
      criterionId: `c${index + 1}`,
      name: `Criterion ${index + 1}`,
      description: "",
      helpText: "",
      weightPoints: 3,
      order: index + 1,
      isCustom: true,
      anchors: [],
    })),
  }
}

function renderEditor(
  orgId = "org-123",
  onContinue: () => void = () => {},
  onChangeChoice?: () => void | Promise<void>
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CriterionEditor
        orgId={orgId}
        organizationName="Acme"
        onContinue={onContinue}
        onChangeChoice={onChangeChoice}
      />
    </NextIntlClientProvider>
  )
}

const editor = messages.dashboard.model.editor

// useQueryMock dispatches on the api ref: the embedded draft panel's
// getOpenSuggestions always returns [], while getModel returns whatever the
// test set via setModel. Keeping the dispatch in the mock implementation (not
// the vi.mock factory) avoids a conditional-hook lint on the factory arrow.
let currentModel: unknown = null
function setModel(model: unknown) {
  currentModel = model
}

describe("CriterionEditor", () => {
  beforeEach(() => {
    addCriterionMock.mockReset()
    removeCriterionMock.mockReset()
    completeOnboardingMock.mockReset()
    useQueryMock.mockReset()
    currentModel = null
    useQueryMock.mockImplementation((ref: unknown) =>
      ref === "ai.suggest.getOpenSuggestions" ? [] : currentModel
    )
  })

  afterEach(() => {
    cleanup()
  })

  it("shows the empty state when the model has no criteria", () => {
    setModel(emptyModel())
    renderEditor()
    expect(screen.getByText(editor.empty)).toBeDefined()
  })

  it("submits the name and six anchors to addCriterion, with no weight input", async () => {
    setModel(emptyModel())
    addCriterionMock.mockResolvedValue("c-new")
    renderEditor("org-abc")

    // The form lives in a dialog; open it via the addCta trigger first.
    fireEvent.click(screen.getByRole("button", { name: editor.addCta }))

    fireEvent.change(screen.getByLabelText(editor.name), {
      target: { value: "Problem solving" },
    })

    const form = screen.getByLabelText(editor.name).closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(addCriterionMock).toHaveBeenCalledTimes(1)
    })

    const call = addCriterionMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(call.orgId).toBe("org-abc")
    expect(call.name).toBe("Problem solving")
    expect(call.anchors).toHaveLength(6)
    // No weight is sent: a new criterion enters at the neutral 3 (ADR-0004).
    expect("weightPoints" in call).toBe(false)
  })

  it("disables Continue below the composition floor and enables it at five", () => {
    setModel(emptyModel())
    const { rerender } = renderEditor()
    const getFinish = () =>
      screen.getByRole("button", {
        name: messages.dashboard.onboarding.screens.nextCta,
      })
    const rerenderEditor = () =>
      rerender(
        <NextIntlClientProvider locale="en" messages={messages}>
          <CriterionEditor
            orgId="org-123"
            organizationName="Acme"
            onContinue={() => {}}
          />
        </NextIntlClientProvider>
      )
    expect(getFinish()).toHaveProperty("disabled", true)

    const hint = messages.dashboard.model.editor.minCriteriaHint.replace(
      "{min}",
      "5"
    )

    // Four criteria: still below the floor, hint visible.
    setModel(modelWithCriteria(4))
    rerenderEditor()
    expect(getFinish()).toHaveProperty("disabled", true)
    expect(screen.getByText(hint)).toBeDefined()

    // Five criteria: the floor is met, the hint is gone.
    setModel(modelWithCriteria(5))
    rerenderEditor()
    expect(getFinish()).toHaveProperty("disabled", false)
    expect(screen.queryByText(hint)).toBeNull()
  })

  it("closes the dialog after a successful addCriterion call", async () => {
    setModel(emptyModel())
    addCriterionMock.mockResolvedValue("c-new")
    renderEditor()

    // Open the dialog, fill the form, submit.
    fireEvent.click(screen.getByRole("button", { name: editor.addCta }))
    const nameInput = screen.getByLabelText(editor.name)
    fireEvent.change(nameInput, { target: { value: "Communication" } })
    expect(nameInput).toHaveProperty("value", "Communication")

    const form = nameInput.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(addCriterionMock).toHaveBeenCalledTimes(1)
    })
    // onAdded closes the controlled dialog, so the form unmounts.
    await waitFor(() => {
      expect(screen.queryByLabelText(editor.name)).toBeNull()
    })
  })

  it("clicking the trash arms the inline confirm: confirm and cancel appear, mutation not yet called", () => {
    setModel(modelWithCriterion())
    renderEditor("org-rm")

    // The remove button is always in the accessibility tree (opacity does not
    // hide from queries; only visual styling changes on hover/focus).
    const removeButton = screen.getByRole("button", {
      name: `${editor.removeCta} Autonomy`,
    })
    fireEvent.click(removeButton)

    // Confirm and cancel are now rendered inline (no dialog).
    expect(
      screen.getByRole("button", { name: editor.removeConfirm })
    ).toBeDefined()
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.model.change.cancel,
      })
    ).toBeDefined()
    // The mutation has NOT been called yet (only armed, not confirmed).
    expect(removeCriterionMock).not.toHaveBeenCalled()
  })

  it("confirming the inline confirm calls removeCriterion with the correct criterionId", async () => {
    setModel(modelWithCriterion())
    removeCriterionMock.mockResolvedValue(undefined)
    renderEditor("org-rm")

    const removeButton = screen.getByRole("button", {
      name: `${editor.removeCta} Autonomy`,
    })
    fireEvent.click(removeButton)

    const confirmButton = screen.getByRole("button", {
      name: editor.removeConfirm,
    })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(removeCriterionMock).toHaveBeenCalledTimes(1)
    })
    const call = removeCriterionMock.mock.calls[0]?.[0] as {
      orgId: string
      criterionId: string
    }
    expect(call.orgId).toBe("org-rm")
    expect(call.criterionId).toBe("c1")
  })

  it("cancelling the inline confirm disarms without calling removeCriterion", () => {
    setModel(modelWithCriterion())
    renderEditor("org-rm")

    const removeButton = screen.getByRole("button", {
      name: `${editor.removeCta} Autonomy`,
    })
    fireEvent.click(removeButton)

    const cancelButton = screen.getByRole("button", {
      name: messages.dashboard.model.change.cancel,
    })
    fireEvent.click(cancelButton)

    expect(removeCriterionMock).not.toHaveBeenCalled()
    // After cancel the trigger (trashcan with removeLabel) is back.
    expect(
      screen.getByRole("button", { name: `${editor.removeCta} Autonomy` })
    ).toBeDefined()
  })

  it("Continue calls onContinue and does not complete onboarding", () => {
    // At the composition floor, so Continue is enabled.
    setModel(modelWithCriteria(5))
    const onContinue = vi.fn()
    renderEditor("org-fin", onContinue)

    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.onboarding.screens.nextCta,
      })
    )

    expect(onContinue).toHaveBeenCalledTimes(1)
    // Completion moves to the families step: the editor never completes.
    expect(completeOnboardingMock).not.toHaveBeenCalled()
  })

  it("renders the change-choice button when onChangeChoice is provided and confirming calls it", () => {
    setModel(emptyModel())
    const onChangeChoice = vi.fn()
    renderEditor("org-123", () => {}, onChangeChoice)

    const change = messages.dashboard.model.change
    // Arm then confirm the two-step control.
    fireEvent.click(screen.getByRole("button", { name: change.cta }))
    fireEvent.click(screen.getByRole("button", { name: change.confirm }))
    expect(onChangeChoice).toHaveBeenCalledTimes(1)
  })

  it("does not render the change-choice button when onChangeChoice is omitted", () => {
    setModel(emptyModel())
    renderEditor()

    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.model.change.cta,
      })
    ).toBeNull()
  })
})
