import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { SiteHeader } from "@/components/site-header"

// The header itself renders real next-intl Links (asserted below), but the
// embedded LanguageSwitcher calls next/navigation hooks that need a mounted
// app router; stub just those, keeping the rest of the module real for
// next-intl's createNavigation.
vi.mock(import("next/navigation"), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    }),
    usePathname: () => "/",
  }
})

const nav = messages.web.nav

function renderHeader() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SiteHeader />
    </NextIntlClientProvider>
  )
}

describe("SiteHeader", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders localized nav links and the login url", () => {
    renderHeader()
    // en is the default locale (unprefixed), so internal hrefs are the
    // plain English slugs.
    expect(
      screen.getByRole("link", { name: nav.how }).getAttribute("href")
    ).toBe("/how-it-works")
    expect(
      screen.getByRole("link", { name: nav.about }).getAttribute("href")
    ).toBe("/about")
    expect(
      screen.getByRole("link", { name: nav.login }).getAttribute("href")
    ).toBe("https://app.blueprnt.se")
  })

  it("renders the mailto CTA", () => {
    renderHeader()
    const cta = screen.getByRole("link", { name: nav.cta })
    expect(cta.getAttribute("href")?.startsWith("mailto:hej@blueprnt.se")).toBe(
      true
    )
  })
})
