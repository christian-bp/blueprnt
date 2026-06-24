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
      screen.getByLabelText(editor.anchorLevel.replace("{level}", "0")),
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
          editor.anchorLevel.replace("{level}", "5")
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

describe("CriterionForm level clarity pass", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the levels helper line under the anchors legend", () => {
    renderForm()
    expect(screen.getByText(editor.levelsIntro)).toBeDefined()
  })

  it("renders all six level labels from 0 to 5", () => {
    renderForm()
    for (let level = 0; level <= 5; level++) {
      expect(
        screen.getByText(editor.anchorLevel.replace("{level}", String(level)))
      ).toBeDefined()
    }
  })

  it("tags the lowest and highest rows", () => {
    renderForm()
    expect(screen.getByText(editor.levelEndpointLowest)).toBeDefined()
    expect(screen.getByText(editor.levelEndpointHighest)).toBeDefined()
  })

  it("gives the 0 and 5 inputs example placeholders", () => {
    renderForm()
    expect(
      screen.getByPlaceholderText(editor.levelPlaceholderLowest)
    ).toBeDefined()
    expect(
      screen.getByPlaceholderText(editor.levelPlaceholderHighest)
    ).toBeDefined()
  })

  it("keeps each anchor input's accessible name exactly the level label", () => {
    renderForm()
    // getByLabelText defaults to exact=true and matches the full accessible
    // name; the explicit aria-label on the input keeps it "Level 0"/"Level 5"
    // even though the visible Label also contains the badge and endpoint tag.
    expect(
      screen.getByLabelText(editor.anchorLevel.replace("{level}", "0"))
    ).toBeDefined()
    expect(
      screen.getByLabelText(editor.anchorLevel.replace("{level}", "5"))
    ).toBeDefined()
  })
})
