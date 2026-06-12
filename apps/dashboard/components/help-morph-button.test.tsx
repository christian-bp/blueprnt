import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { HelpMorphButton } from "@/components/help-morph-button"

function renderHelp() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <HelpMorphButton label="What is a criterion?">
        Criteria are what roles are rated against.
      </HelpMorphButton>
    </NextIntlClientProvider>
  )
}

describe("HelpMorphButton", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders an icon-only trigger named by the label", () => {
    renderHelp()
    const trigger = screen.getByRole("button", {
      name: "What is a criterion?",
    })
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
  })

  it("closes on pointerdown outside", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <div>
          <button type="button">elsewhere</button>
          <HelpMorphButton label="Help label">Body text.</HelpMorphButton>
        </div>
      </NextIntlClientProvider>
    )
    fireEvent.click(screen.getByRole("button", { name: "Help label" }))
    expect(screen.getByText("Body text.")).toBeDefined()
    // Radix attaches its document pointerdown listener in a setTimeout(0),
    // so the outside click needs a tick after opening.
    await new Promise((resolve) => setTimeout(resolve, 20))
    fireEvent.pointerDown(screen.getByRole("button", { name: "elsewhere" }))
    await waitFor(() => {
      expect(screen.queryByText("Body text.")).toBeNull()
    })
  })

  it("morphs open with the help text and closes on Escape", async () => {
    renderHelp()
    fireEvent.click(
      screen.getByRole("button", { name: "What is a criterion?" })
    )
    // forceMount + owned presence: the portaled panel exists in the tree
    // even under happy-dom (unlike popper-measured default mounting).
    const body = screen.getByText("Criteria are what roles are rated against.")
    expect(body).toBeDefined()

    fireEvent.keyDown(body, { key: "Escape" })
    await waitFor(() => {
      expect(
        screen.queryByText("Criteria are what roles are rated against.")
      ).toBeNull()
    })
  })
})
