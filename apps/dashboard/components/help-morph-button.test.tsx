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
    expect(
      screen.getByRole("button", { name: "What is a criterion?" })
    ).toBeDefined()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("morphs into a dialog with the help text and closes again", async () => {
    renderHelp()
    fireEvent.click(
      screen.getByRole("button", { name: "What is a criterion?" })
    )
    expect(
      screen.getByRole("dialog", { name: "What is a criterion?" })
    ).toBeDefined()
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
