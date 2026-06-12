import { cleanup, fireEvent, render, screen } from "@testing-library/react"
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

  it("morphs open with the help text and closes from the close button", async () => {
    renderHelp()
    fireEvent.click(
      screen.getByRole("button", { name: "What is a criterion?" })
    )
    // forceMount + owned presence: the portaled panel exists in the tree
    // even under happy-dom (unlike popper-measured default mounting).
    expect(
      screen.getByText("Criteria are what roles are rated against.")
    ).toBeDefined()

    fireEvent.click(
      screen.getByRole("button", { name: messages.dashboard.help.close })
    )
    expect(
      await screen.findByRole("button", { name: "What is a criterion?" })
    ).toBeDefined()
  })
})
