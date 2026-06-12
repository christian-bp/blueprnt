import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { Approach } from "@/components/approach"
import { ComplianceBand } from "@/components/compliance-band"
import { ContactCta } from "@/components/contact-cta"
import { FrameworkSteps } from "@/components/framework-steps"
import { Hero } from "@/components/hero"
import { ModelUsp } from "@/components/model-usp"

const web = messages.web

function renderSection(section: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {section}
    </NextIntlClientProvider>
  )
}

describe("landing sections", () => {
  afterEach(() => {
    cleanup()
  })

  it("hero renders the headline and the illustration alt text", () => {
    renderSection(<Hero />)
    const h1 = screen.getByRole("heading", { level: 1 })
    expect(h1.textContent).toContain(web.hero.titleLead)
    expect(h1.textContent).toContain(web.hero.titleAccent)
    expect(screen.getByAltText(web.hero.imageAlt)).toBeTruthy()
  })

  it("hero links the primary CTA to mail and the secondary to the framework anchor", () => {
    renderSection(<Hero />)
    expect(
      screen
        .getByRole("link", { name: web.hero.ctaPrimary })
        .getAttribute("href")
    ).toBe(`mailto:${web.contact.email}`)
    expect(
      screen
        .getByRole("link", { name: web.hero.ctaSecondary })
        .getAttribute("href")
    ).toBe("#framework")
  })

  it("framework section renders its heading and the three step cards", () => {
    renderSection(<FrameworkSteps />)
    expect(
      screen.getByRole("heading", { name: web.framework.heading })
    ).toBeTruthy()
    expect(screen.getByText(web.framework.kicker)).toBeTruthy()
    for (const step of Object.values(web.framework.steps)) {
      expect(screen.getByRole("heading", { name: step.title })).toBeTruthy()
    }
  })

  it("model section renders its composed heading and the four feature cards", () => {
    renderSection(<ModelUsp />)
    const heading = screen.getByRole("heading", { level: 2 })
    expect(heading.textContent).toContain(web.model.titleAccent)
    expect(heading.textContent).toContain(web.model.titleTail)
    for (const card of Object.values(web.model.cards)) {
      expect(screen.getByRole("heading", { name: card.title })).toBeTruthy()
    }
  })

  it("compliance band renders its heading, the checklist, and the stat", () => {
    renderSection(<ComplianceBand />)
    expect(
      screen.getByRole("heading", { name: web.compliance.title })
    ).toBeTruthy()
    for (const item of Object.values(web.compliance.items)) {
      expect(screen.getByText(item)).toBeTruthy()
    }
    expect(screen.getByText(web.compliance.statValue)).toBeTruthy()
    expect(screen.getByText(web.compliance.statLabel)).toBeTruthy()
  })

  it("approach section renders its heading and the four steps", () => {
    renderSection(<Approach />)
    expect(
      screen.getByRole("heading", { name: web.approach.heading })
    ).toBeTruthy()
    for (const step of Object.values(web.approach.steps)) {
      expect(screen.getByRole("heading", { name: step.title })).toBeTruthy()
    }
  })

  it("contact CTA renders the heading and a single mailto link carrying the address", () => {
    renderSection(<ContactCta />)
    expect(
      screen.getByRole("heading", { name: web.contact.heading })
    ).toBeTruthy()
    // One ink button whose label IS the email address.
    const links = screen
      .getAllByRole("link")
      .filter((l) => (l.textContent ?? "").includes(web.contact.email))
    expect(links).toHaveLength(1)
    // biome-ignore lint/style/noNonNullAssertion: length asserted above
    expect(links[0]!.getAttribute("href")).toBe(`mailto:${web.contact.email}`)
  })
})
