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

  it("keeps submit disabled until a name is typed", async () => {
    renderForm()
    const submit = screen.getByRole("button", {
      name: "Submit",
    }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(editor.name), {
      target: { value: "Problem solving" },
    })
    await waitFor(() => {
      expect(submit.disabled).toBe(false)
    })
    expect(onSubmitMock).not.toHaveBeenCalled()
  })

  it("submits trimmed values with all six anchors and resets in add mode", async () => {
    onSubmitMock.mockResolvedValue(undefined)
    renderForm()
    fireEvent.change(screen.getByLabelText(editor.name), {
      target: { value: "  Problem solving  " },
    })
    fireEvent.change(
      screen.getByLabelText(editor.anchorStep.replace("{step}", "0")),
      { target: { value: "None" } }
    )
    fireEvent.submit(
      screen.getByLabelText(editor.name).closest("form") as HTMLFormElement
    )

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
          editor.anchorStep.replace("{step}", "5")
        ) as HTMLInputElement
      ).value
    ).toBe("a5")

    fireEvent.submit(
      screen.getByLabelText(editor.name).closest("form") as HTMLFormElement
    )
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
    fireEvent.submit(
      screen.getByLabelText(editor.name).closest("form") as HTMLFormElement
    )
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
  })
})

describe("CriterionForm step clarity pass", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the steps helper line under the anchors legend", () => {
    renderForm()
    expect(screen.getByText(editor.stepsIntro)).toBeDefined()
  })

  it("renders all six step labels from 0 to 5", () => {
    renderForm()
    for (let step = 0; step <= 5; step++) {
      expect(
        screen.getByText(editor.anchorStep.replace("{step}", String(step)))
      ).toBeDefined()
    }
  })

  it("tags the lowest and highest rows", () => {
    renderForm()
    expect(screen.getByText(editor.stepEndpointLowest)).toBeDefined()
    expect(screen.getByText(editor.stepEndpointHighest)).toBeDefined()
  })

  it("gives the 0 and 5 inputs example placeholders", () => {
    renderForm()
    expect(
      screen.getByPlaceholderText(editor.stepPlaceholderLowest)
    ).toBeDefined()
    expect(
      screen.getByPlaceholderText(editor.stepPlaceholderHighest)
    ).toBeDefined()
  })

  it("keeps each anchor input's accessible name exactly the step label", () => {
    renderForm()
    // getByLabelText defaults to exact=true and matches the full accessible
    // name; the explicit aria-label on the input keeps it "Step 0"/"Step 5"
    // even though the visible Label also contains the badge and endpoint tag.
    expect(
      screen.getByLabelText(editor.anchorStep.replace("{step}", "0"))
    ).toBeDefined()
    expect(
      screen.getByLabelText(editor.anchorStep.replace("{step}", "5"))
    ).toBeDefined()
  })
})
