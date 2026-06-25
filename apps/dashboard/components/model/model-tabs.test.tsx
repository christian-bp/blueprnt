import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const pathState = vi.hoisted(() => ({ current: "/model" }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

import { ModelTabs } from "@/components/model/model-tabs"

const CRITERIA = messages.dashboard.model.tabs.criteria
const WEIGHTING = messages.dashboard.model.tabs.weighting

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

  it("links Criteria and Weighting to their pages", () => {
    renderTabs()
    expect(
      screen.getByRole("link", { name: CRITERIA }).getAttribute("href")
    ).toBe("/model")
    expect(
      screen.getByRole("link", { name: WEIGHTING }).getAttribute("href")
    ).toBe("/model/weighting")
  })

  it("marks Criteria as current on /model", () => {
    pathState.current = "/model"
    renderTabs()
    expect(
      screen.getByRole("link", { name: CRITERIA }).getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("link", { name: WEIGHTING }).getAttribute("aria-current")
    ).toBeNull()
  })

  it("marks Weighting as current on /model/weighting", () => {
    pathState.current = "/model/weighting"
    renderTabs()
    expect(
      screen.getByRole("link", { name: WEIGHTING }).getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("link", { name: CRITERIA }).getAttribute("aria-current")
    ).toBeNull()
  })
})
