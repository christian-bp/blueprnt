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
import {
  CriterionForm,
  type CriterionFormValues,
} from "@/components/model/criterion-form"

const editor = messages.dashboard.model.editor
const onSubmitMock = vi.fn()

function renderForm(initialValues?: CriterionFormValues) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CriterionForm
        initialValues={initialValues}
        submitLabel="Submit"
        onSubmit={onSubmitMock}
      />
    </NextIntlClientProvider>
  )
}

const PREFILL: CriterionFormValues = {
  name: "Scope",
  description: "How broad the role is.",
  helpText: "Judge against the anchors.",
  anchors: ["a0", "a1", "a2", "a3", "a4", "a5"],
}

describe("CriterionForm", () => {
  beforeEach(() => {
    onSubmitMock.mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("disables the submit button until a name is typed", () => {
    renderForm()
    const submit = screen.getByRole("button", { name: "Submit" })
    expect(submit).toHaveProperty("disabled", true)

    fireEvent.change(screen.getByLabelText(editor.name), {
      target: { value: "Problem solving" },
    })
    expect(submit).toHaveProperty("disabled", false)
  })

  it("submits trimmed values with all six anchors and resets in add mode", async () => {
    onSubmitMock.mockResolvedValue(undefined)
    renderForm()
    fireEvent.change(screen.getByLabelText(editor.name), {
      target: { value: "  Problem solving  " },
    })
    fireEvent.change(
      screen.getByLabelText(editor.anchorLevel.replace("{level}", "0")),
      { target: { value: "None" } }
    )
    fireEvent.click(screen.getByRole("button", { name: "Submit" }))

    await waitFor(() => {
      expect(onSubmitMock).toHaveBeenCalledWith({
        name: "Problem solving",
        description: "",
        helpText: "",
        anchors: ["None", "", "", "", "", ""],
      })
    })
    // Add mode (no initialValues): the fields reset after success.
    await waitFor(() => {
      expect(
        (screen.getByLabelText(editor.name) as HTMLInputElement).value
      ).toBe("")
    })
  })

  it("prefills from initialValues and keeps them after saving (edit mode)", async () => {
    onSubmitMock.mockResolvedValue(undefined)
    renderForm(PREFILL)
    expect((screen.getByLabelText(editor.name) as HTMLInputElement).value).toBe(
      "Scope"
    )
    expect(
      (
        screen.getByLabelText(
          editor.anchorLevel.replace("{level}", "5")
        ) as HTMLInputElement
      ).value
    ).toBe("a5")

    fireEvent.click(screen.getByRole("button", { name: "Submit" }))
    await waitFor(() => {
      expect(onSubmitMock).toHaveBeenCalledWith(PREFILL)
    })
    expect((screen.getByLabelText(editor.name) as HTMLInputElement).value).toBe(
      "Scope"
    )
  })

  it("shows the error line when the submit rejects", async () => {
    onSubmitMock.mockRejectedValue(new Error("errors.invalidInput"))
    renderForm(PREFILL)
    fireEvent.click(screen.getByRole("button", { name: "Submit" }))
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
  })
})
