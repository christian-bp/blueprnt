import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const pathState = vi.hoisted(() => ({ current: "/people" }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

import { PeopleTabs } from "@/components/people/people-tabs"

const PEOPLE = messages.dashboard.people.tabs.people
const CLASSIFY = messages.dashboard.people.tabs.classify

function renderTabs() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PeopleTabs />
    </NextIntlClientProvider>
  )
}

describe("PeopleTabs", () => {
  beforeEach(() => {
    pathState.current = "/people"
  })
  afterEach(() => cleanup())

  it("links People and Classify to their pages", () => {
    renderTabs()
    expect(
      screen.getByRole("link", { name: PEOPLE }).getAttribute("href")
    ).toBe("/people")
    expect(
      screen.getByRole("link", { name: CLASSIFY }).getAttribute("href")
    ).toBe("/people/classify")
  })

  it("marks People as current on /people", () => {
    pathState.current = "/people"
    renderTabs()
    expect(
      screen.getByRole("link", { name: PEOPLE }).getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("link", { name: CLASSIFY }).getAttribute("aria-current")
    ).toBeNull()
  })

  it("keeps People current on a person detail page", () => {
    pathState.current = "/people/anna-svensson"
    renderTabs()
    expect(
      screen.getByRole("link", { name: PEOPLE }).getAttribute("aria-current")
    ).toBe("page")
  })

  it("marks Classify as current on /people/classify", () => {
    pathState.current = "/people/classify"
    renderTabs()
    expect(
      screen.getByRole("link", { name: CLASSIFY }).getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("link", { name: PEOPLE }).getAttribute("aria-current")
    ).toBeNull()
  })
})
