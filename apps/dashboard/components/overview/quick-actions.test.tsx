import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { QuickActions } from "@/components/overview/quick-actions"

const t = messages.dashboard.overview.quickActions

function renderActions() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QuickActions />
    </NextIntlClientProvider>
  )
}

describe("QuickActions", () => {
  afterEach(cleanup)

  it("links each chip's label to its owning surface", () => {
    renderActions()
    const cases: [string, string][] = [
      [t.importEmployees, "/people/import"],
      [t.classify, "/people/classify"],
      [t.roles, "/roles"],
      [t.startPayMapping, "/pay-mappings"],
    ]
    for (const [label, href] of cases) {
      expect(
        screen.getByRole("link", { name: label }).getAttribute("href")
      ).toBe(href)
    }
  })

  it("renders exactly the four chips, in order", () => {
    renderActions()
    const links = screen.getAllByRole("link")
    expect(links.map((l) => l.textContent)).toEqual([
      t.importEmployees,
      t.classify,
      t.roles,
      t.startPayMapping,
    ])
  })
})
