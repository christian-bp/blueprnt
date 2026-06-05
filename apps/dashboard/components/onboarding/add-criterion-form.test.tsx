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

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (ref === "evaluationModel.criteria.addCriterion") return addCriterionMock
    return vi.fn()
  },
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    evaluationModel: {
      criteria: { addCriterion: "evaluationModel.criteria.addCriterion" },
    },
  },
}))

import { AddCriterionForm } from "@/components/onboarding/add-criterion-form"

function renderForm(orgId = "org-123", onAdded?: () => void) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AddCriterionForm orgId={orgId} onAdded={onAdded} />
    </NextIntlClientProvider>
  )
}

const editor = messages.dashboard.onboarding.model.editor

describe("AddCriterionForm", () => {
  beforeEach(() => {
    addCriterionMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("disables the add button until a name is typed", () => {
    renderForm()
    const addButton = screen.getByRole("button", { name: editor.addCta })
    expect(addButton).toHaveProperty("disabled", true)

    fireEvent.change(screen.getByLabelText(editor.name), {
      target: { value: "Problem solving" },
    })
    expect(addButton).toHaveProperty("disabled", false)
  })

  it("submits a numeric importanceLevel and six anchors to addCriterion", async () => {
    addCriterionMock.mockResolvedValue("c-new")
    renderForm("org-abc")

    fireEvent.change(screen.getByLabelText(editor.name), {
      target: { value: "Problem solving" },
    })

    const addButton = screen.getByRole("button", { name: editor.addCta })
    const form = addButton.closest("form")
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

  it("resets the form after a successful addCriterion call", async () => {
    addCriterionMock.mockResolvedValue("c-new")
    renderForm()

    const nameInput = screen.getByLabelText(editor.name)
    fireEvent.change(nameInput, { target: { value: "Communication" } })
    expect(nameInput).toHaveProperty("value", "Communication")

    const addButton = screen.getByRole("button", { name: editor.addCta })
    const form = addButton.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(
        (screen.getByLabelText(editor.name) as HTMLInputElement).value
      ).toBe("")
    })
  })

  it("calls onAdded after a successful addCriterion call", async () => {
    addCriterionMock.mockResolvedValue("c-new")
    const onAdded = vi.fn()
    renderForm("org-cb", onAdded)

    fireEvent.change(screen.getByLabelText(editor.name), {
      target: { value: "Communication" },
    })

    const addButton = screen.getByRole("button", { name: editor.addCta })
    const form = addButton.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(onAdded).toHaveBeenCalledTimes(1)
    })
  })

  it("does not call onAdded when addCriterion rejects", async () => {
    addCriterionMock.mockRejectedValue(new Error("ConvexError: invalidInput"))
    const onAdded = vi.fn()
    renderForm("org-cb", onAdded)

    fireEvent.change(screen.getByLabelText(editor.name), {
      target: { value: "Communication" },
    })

    const addButton = screen.getByRole("button", { name: editor.addCta })
    const form = addButton.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    expect(onAdded).not.toHaveBeenCalled()
  })

  it("surfaces the error alert when addCriterion rejects", async () => {
    addCriterionMock.mockRejectedValue(new Error("ConvexError: invalidInput"))
    renderForm()

    fireEvent.change(screen.getByLabelText(editor.name), {
      target: { value: "Communication" },
    })

    const addButton = screen.getByRole("button", { name: editor.addCta })
    const form = addButton.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
  })
})
