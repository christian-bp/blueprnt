import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const pathState = vi.hoisted(() => ({ current: "/model" }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

import { ModelTabs } from "@/components/model/model-tabs"

const BUILD = messages.dashboard.model.tabs.build
const METHOD = messages.dashboard.model.tabs.method

function renderTabs() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ModelTabs />
    </NextIntlClientProvider>
  )
}

describe("ModelTabs", () => {
  beforeEach(() => {
    pathState.current = "/model"
  })
  afterEach(() => cleanup())

  // Two tabs, not three: weighting is no longer a place of its own, it is
  // something you do on the card the criterion sits in.
  it("links the build view and Method to their pages, and nothing else", () => {
    renderTabs()
    const links = screen.getAllByRole("link")
    expect(links.map((link) => link.textContent)).toEqual([BUILD, METHOD])
    expect(screen.getByRole("link", { name: BUILD }).getAttribute("href")).toBe(
      "/model"
    )
    expect(
      screen.getByRole("link", { name: METHOD }).getAttribute("href")
    ).toBe("/model/method")
  })

  it("marks the build view as current on /model", () => {
    pathState.current = "/model"
    renderTabs()
    expect(
      screen.getByRole("link", { name: BUILD }).getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("link", { name: METHOD }).getAttribute("aria-current")
    ).toBeNull()
  })

  it("marks Method as current on /model/method", () => {
    pathState.current = "/model/method"
    renderTabs()
    expect(
      screen.getByRole("link", { name: METHOD }).getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("link", { name: BUILD }).getAttribute("aria-current")
    ).toBeNull()
  })

  // The retired route redirects to /model, and the tab strip renders while
  // that redirect resolves: the build tab is the one that is current there,
  // never neither of them.
  it("keeps the build view current on the retired weighting route", () => {
    pathState.current = "/model/weighting"
    renderTabs()
    expect(
      screen.getByRole("link", { name: BUILD }).getAttribute("aria-current")
    ).toBe("page")
  })
})
