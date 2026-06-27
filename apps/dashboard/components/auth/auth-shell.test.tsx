import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { AuthShell } from "./auth-shell"

function renderShell(props: Parameters<typeof AuthShell>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AuthShell {...props} />
    </NextIntlClientProvider>
  )
}

afterEach(() => cleanup())

describe("AuthShell", () => {
  it("renders its children", () => {
    renderShell({ children: <div data-testid="content" /> })
    expect(screen.getByTestId("content")).toBeDefined()
  })

  it("renders the headerRight and footer slots when provided", () => {
    renderShell({
      children: <div />,
      headerRight: <div data-testid="hr" />,
      footer: <div data-testid="ft" />,
    })
    expect(screen.getByTestId("hr")).toBeDefined()
    expect(screen.getByTestId("ft")).toBeDefined()
  })

  it("omits the slots when not provided", () => {
    renderShell({ children: <div /> })
    expect(screen.queryByTestId("hr")).toBeNull()
    expect(screen.queryByTestId("ft")).toBeNull()
  })
})
