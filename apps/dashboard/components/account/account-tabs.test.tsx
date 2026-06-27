"use client"

import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const pathState = vi.hoisted(() => ({ current: "/account/profile" }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

import { AccountTabs } from "@/components/account/account-tabs"

const PROFILE = messages.dashboard.account.tabs.profile
const SECURITY = messages.dashboard.account.tabs.security

function renderTabs() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AccountTabs />
    </NextIntlClientProvider>
  )
}

describe("AccountTabs", () => {
  beforeEach(() => {
    pathState.current = "/account/profile"
  })
  afterEach(() => cleanup())

  it("links Profile and Security to their pages", () => {
    renderTabs()
    expect(
      screen.getByRole("link", { name: PROFILE }).getAttribute("href")
    ).toBe("/account/profile")
    expect(
      screen.getByRole("link", { name: SECURITY }).getAttribute("href")
    ).toBe("/account/security")
  })

  it("marks Profile as current on /account/profile", () => {
    pathState.current = "/account/profile"
    renderTabs()
    expect(
      screen.getByRole("link", { name: PROFILE }).getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("link", { name: SECURITY }).getAttribute("aria-current")
    ).toBeNull()
  })

  it("marks Security as current on /account/security", () => {
    pathState.current = "/account/security"
    renderTabs()
    expect(
      screen.getByRole("link", { name: SECURITY }).getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("link", { name: PROFILE }).getAttribute("aria-current")
    ).toBeNull()
  })
})
