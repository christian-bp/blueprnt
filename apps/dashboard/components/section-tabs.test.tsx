import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const pathState = vi.hoisted(() => ({ current: "/work" }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

import { SectionTabs } from "@/components/section-tabs"

const OVERVIEW = messages.dashboard.nav.overview
const ROLES = messages.dashboard.nav.roles

function renderTabs() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SectionTabs />
    </NextIntlClientProvider>
  )
}

describe("SectionTabs", () => {
  beforeEach(() => {
    pathState.current = "/work"
  })
  afterEach(() => cleanup())

  it("links Overview and Roles to their pages", () => {
    renderTabs()
    expect(
      screen.getByRole("link", { name: OVERVIEW }).getAttribute("href")
    ).toBe("/work")
    expect(screen.getByRole("link", { name: ROLES }).getAttribute("href")).toBe(
      "/roles"
    )
  })

  it("marks Overview as current on /work", () => {
    pathState.current = "/work"
    renderTabs()
    expect(
      screen.getByRole("link", { name: OVERVIEW }).getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("link", { name: ROLES }).getAttribute("aria-current")
    ).toBeNull()
  })

  it("marks Roles as current on a nested /roles path", () => {
    pathState.current = "/roles/r1"
    renderTabs()
    expect(
      screen.getByRole("link", { name: ROLES }).getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("link", { name: OVERVIEW }).getAttribute("aria-current")
    ).toBeNull()
  })
})
