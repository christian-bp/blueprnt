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
        importanceLevel: 5,
        order: 1,
        isCustom: true,
        anchors: [],
      },
    ],
  }
}

function renderEditor(
  orgId = "org-123",
  onFinished: () => void = () => {},
  onBack?: () => void,
  onChangeChoice?: () => void | Promise<void>
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CriterionEditor
        orgId={orgId}
        onFinished={onFinished}
        onBack={onBack}
        onChangeChoice={onChangeChoice}
      />
    </NextIntlClientProvider>
  )
}

const editor = messages.dashboard.onboarding.model.editor

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

  it("submits a numeric importanceLevel and six anchors to addCriterion", async () => {
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

    const call = addCriterionMock.mock.calls[0]?.[0] as {
      orgId: string
      name: string
      importanceLevel: unknown
      anchors: unknown[]
    }
    expect(call.orgId).toBe("org-abc")
    expect(call.name).toBe("Problem solving")
    // importanceLevel must reach the backend as a NUMBER, never a string.
    expect(typeof call.importanceLevel).toBe("number")
    expect(call.anchors).toHaveLength(6)
  })

  it("disables Finish with zero criteria and enables it with one", () => {
    setModel(emptyModel())
    const { rerender } = renderEditor()
    const getFinish = () => screen.getByRole("button", { name: editor.doneCta })
    expect(getFinish()).toHaveProperty("disabled", true)

    setModel(modelWithCriterion())
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <CriterionEditor orgId="org-123" onFinished={() => {}} />
      </NextIntlClientProvider>
    )
    expect(getFinish()).toHaveProperty("disabled", false)
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
    expect(screen.getByRole("button", { name: editor.removeCta })).toBeDefined()
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.onboarding.model.change.cancel,
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

    // The inline confirm button shares the removeCta label.
    const confirmButton = screen.getByRole("button", { name: editor.removeCta })
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
      name: messages.dashboard.onboarding.model.change.cancel,
    })
    fireEvent.click(cancelButton)

    expect(removeCriterionMock).not.toHaveBeenCalled()
    // After cancel the trigger (trashcan with removeLabel) is back.
    expect(
      screen.getByRole("button", { name: `${editor.removeCta} Autonomy` })
    ).toBeDefined()
  })

  it("Finish calls completeOnboarding before onFinished", async () => {
    setModel(modelWithCriterion())
    completeOnboardingMock.mockResolvedValue(null)
    const onFinished = vi.fn()
    renderEditor("org-fin", onFinished)

    fireEvent.click(screen.getByRole("button", { name: editor.doneCta }))

    await waitFor(() => {
      expect(completeOnboardingMock).toHaveBeenCalledWith({ orgId: "org-fin" })
    })
    expect(onFinished).toHaveBeenCalledTimes(1)
  })

  it("renders the back button when onBack is provided and calls it on click", () => {
    setModel(emptyModel())
    const onBack = vi.fn()
    renderEditor("org-123", () => {}, onBack)

    const backButton = screen.getByRole("button", {
      name: messages.dashboard.onboarding.back,
    })
    fireEvent.click(backButton)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("does not render the back button when onBack is omitted", () => {
    setModel(emptyModel())
    renderEditor()

    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.onboarding.back,
      })
    ).toBeNull()
  })

  it("renders the change-choice button when onChangeChoice is provided and confirming calls it", () => {
    setModel(emptyModel())
    const onChangeChoice = vi.fn()
    renderEditor("org-123", () => {}, undefined, onChangeChoice)

    const change = messages.dashboard.onboarding.model.change
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
        name: messages.dashboard.onboarding.model.change.cta,
      })
    ).toBeNull()
  })

  it("Finish surfaces the error alert and does not finish when completion fails", async () => {
    setModel(modelWithCriterion())
    completeOnboardingMock.mockRejectedValue(new Error("ConvexError: notFound"))
    const onFinished = vi.fn()
    renderEditor("org-fin", onFinished)

    fireEvent.click(screen.getByRole("button", { name: editor.doneCta }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    expect(onFinished).not.toHaveBeenCalled()
  })
})
