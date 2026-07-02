import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { GettingStartedCard } from "@/components/overview/getting-started-card"

describe("GettingStartedCard", () => {
  afterEach(cleanup)

  it("renders the title, body, and a link to the model", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <GettingStartedCard />
      </NextIntlClientProvider>
    )
    expect(screen.getByText("Getting started")).toBeDefined()
    expect(
      screen.getByText(
        "Build your model, describe your roles, then evaluate them against the criteria."
      )
    ).toBeDefined()
    const link = screen.getByRole("link", { name: "Go to the model" })
    expect(link.getAttribute("href")).toBe("/model")
  })
})
