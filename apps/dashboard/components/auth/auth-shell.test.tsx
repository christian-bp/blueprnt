import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { AuthShell } from "./auth-shell"

afterEach(() => cleanup())

describe("AuthShell", () => {
  it("renders its children", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AuthShell>
          <div data-testid="content" />
        </AuthShell>
      </NextIntlClientProvider>
    )
    expect(screen.getByTestId("content")).toBeDefined()
  })
})
