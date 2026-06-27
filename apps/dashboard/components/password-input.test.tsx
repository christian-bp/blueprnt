import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import en from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { PasswordInput } from "./password-input"

function renderInput() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PasswordInput aria-label="pw" defaultValue="secret" />
    </NextIntlClientProvider>
  )
}

afterEach(() => cleanup())

describe("PasswordInput", () => {
  it("masks the value by default", () => {
    renderInput()
    const input = screen.getByLabelText("pw") as HTMLInputElement
    expect(input.type).toBe("password")
    expect(
      screen.getByRole("button", { name: en.dashboard.auth.showPassword })
    ).toBeDefined()
  })

  it("reveals the value and toggles the label, then hides it again", () => {
    renderInput()
    const input = screen.getByLabelText("pw") as HTMLInputElement

    fireEvent.click(
      screen.getByRole("button", { name: en.dashboard.auth.showPassword })
    )
    expect(input.type).toBe("text")

    fireEvent.click(
      screen.getByRole("button", { name: en.dashboard.auth.hidePassword })
    )
    expect(input.type).toBe("password")
  })

  it("does not submit the surrounding form when toggled", () => {
    let submitted = false
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitted = true
          }}
        >
          <PasswordInput aria-label="pw" />
        </form>
      </NextIntlClientProvider>
    )
    fireEvent.click(
      screen.getByRole("button", { name: en.dashboard.auth.showPassword })
    )
    expect(submitted).toBe(false)
  })
})
