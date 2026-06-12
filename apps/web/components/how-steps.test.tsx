import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { ContactCta } from "@/components/contact-cta"
import { HowSteps } from "@/components/how-steps"

const web = messages.web

function renderSection(section: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {section}
    </NextIntlClientProvider>
  )
}

describe("how-it-works page", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the page heading as the h1", () => {
    renderSection(<HowSteps />)
    const h1 = screen.getByRole("heading", { level: 1 })
    expect(h1.textContent).toBe(web.how.heading)
    expect(screen.getByText(web.how.lede)).toBeTruthy()
  })

  it("renders all five step titles with their numbers", () => {
    renderSection(<HowSteps />)
    for (const step of Object.values(web.how.steps)) {
      expect(screen.getByRole("heading", { name: step.title })).toBeTruthy()
      expect(screen.getByText(step.step)).toBeTruthy()
    }
  })

  it("page composition ends on the contact CTA with the mailto link", () => {
    renderSection(
      <>
        <HowSteps />
        <ContactCta />
      </>
    )
    const links = screen
      .getAllByRole("link")
      .filter((l) => (l.textContent ?? "").includes(web.contact.email))
    expect(links).toHaveLength(1)
    // biome-ignore lint/style/noNonNullAssertion: length asserted above
    expect(links[0]!.getAttribute("href")).toBe(`mailto:${web.contact.email}`)
  })
})
