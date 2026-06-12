import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { AboutCta } from "@/components/about-cta"
import { AboutHero } from "@/components/about-hero"
import { AboutStory } from "@/components/about-story"
import { AboutTeam } from "@/components/about-team"

const web = messages.web

function renderSection(section: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {section}
    </NextIntlClientProvider>
  )
}

describe("about page sections", () => {
  afterEach(() => {
    cleanup()
  })

  it("hero renders the h1 from web.about.heading", () => {
    renderSection(<AboutHero />)
    const h1 = screen.getByRole("heading", { level: 1 })
    expect(h1.textContent).toBe(web.about.heading)
  })

  it("hero renders the heading and lede", () => {
    renderSection(<AboutHero />)
    expect(screen.getByText(web.about.lede)).toBeTruthy()
  })

  it("story renders the split heading and all three paragraphs", () => {
    renderSection(<AboutStory />)
    const h2 = screen.getByRole("heading", { level: 2 })
    // titleLead and titleAccent appear in the same h2 node
    expect(h2.textContent).toContain(web.about.story.titleLead)
    expect(h2.textContent).toContain(web.about.story.titleAccent)
    expect(screen.getByText(web.about.story.p1)).toBeTruthy()
    expect(screen.getByText(web.about.story.p2)).toBeTruthy()
    expect(screen.getByText(web.about.story.p3)).toBeTruthy()
  })

  it("team renders the section heading, lede, and all three member names with their roles", () => {
    renderSection(<AboutTeam />)
    expect(
      screen.getByRole("heading", { name: web.about.team.heading })
    ).toBeTruthy()
    expect(screen.getByText(web.about.team.lede)).toBeTruthy()

    for (const member of Object.values(web.about.team.members)) {
      expect(screen.getByRole("heading", { name: member.name })).toBeTruthy()
      expect(screen.getByText(member.role)).toBeTruthy()
    }
  })

  it("about CTA renders its heading and a mailto link with the email address", () => {
    renderSection(<AboutCta />)
    expect(
      screen.getByRole("heading", { name: web.about.cta.heading })
    ).toBeTruthy()
    const links = screen
      .getAllByRole("link")
      .filter((l) => (l.textContent ?? "").includes(web.contact.email))
    expect(links).toHaveLength(1)
    // biome-ignore lint/style/noNonNullAssertion: length asserted above
    expect(links[0]!.getAttribute("href")).toBe(`mailto:${web.contact.email}`)
  })

  it("page composition renders h1 heading, all three team member cards, and the mailto CTA", () => {
    renderSection(
      <>
        <AboutHero />
        <AboutStory />
        <AboutTeam />
        <AboutCta />
      </>
    )
    // h1 is the page heading
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      web.about.heading
    )
    // All three team members present
    for (const member of Object.values(web.about.team.members)) {
      expect(screen.getByRole("heading", { name: member.name })).toBeTruthy()
    }
    // Closing CTA mailto
    const links = screen
      .getAllByRole("link")
      .filter((l) => (l.textContent ?? "").includes(web.contact.email))
    expect(links.length).toBeGreaterThanOrEqual(1)
  })
})
