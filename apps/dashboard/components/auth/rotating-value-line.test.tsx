import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { RotatingValueLine } from "./rotating-value-line"

afterEach(() => cleanup())

describe("RotatingValueLine", () => {
  it("renders the first brand value line", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RotatingValueLine />
      </NextIntlClientProvider>
    )
    expect(screen.getByText(messages.dashboard.auth.brand.value1)).toBeDefined()
  })
})
