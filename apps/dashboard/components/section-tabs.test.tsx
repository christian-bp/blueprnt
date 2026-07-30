import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const pathState = vi.hoisted(() => ({ current: "/work" }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

// Controls what each query returns per test (undefined = loading), keyed by
// the mocked api reference string.
const queryResults = vi.hoisted(() => ({}) as Record<string, unknown>)
vi.mock("convex/react", () => ({
  useQuery: (query: string) => queryResults[query],
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    assessment: {
      roles: { listRoles: "assessment.roles.listRoles" },
      results: { getResults: "assessment.results.getResults" },
    },
  },
}))

vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org1", name: "Acme", role: "admin" }),
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

function setQueries(roles: unknown, results: unknown) {
  queryResults["assessment.roles.listRoles"] = roles
  queryResults["assessment.results.getResults"] = results
}

describe("SectionTabs", () => {
  beforeEach(() => {
    pathState.current = "/work"
    setQueries(undefined, undefined)
  })
  afterEach(() => cleanup())

  it("links Overview and Roles to their pages", () => {
    renderTabs()
    expect(
      screen.getByRole("link", { name: OVERVIEW }).getAttribute("href")
    ).toBe("/work")
    expect(
      screen.getByRole("link", { name: new RegExp(ROLES) }).getAttribute("href")
    ).toBe("/roles")
  })

  it("marks Overview as current on /work", () => {
    pathState.current = "/work"
    renderTabs()
    expect(
      screen.getByRole("link", { name: OVERVIEW }).getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen
        .getByRole("link", { name: new RegExp(ROLES) })
        .getAttribute("aria-current")
    ).toBeNull()
  })

  it("marks Roles as current on a nested /roles path", () => {
    pathState.current = "/roles/r1"
    renderTabs()
    expect(
      screen
        .getByRole("link", { name: new RegExp(ROLES) })
        .getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("link", { name: OVERVIEW }).getAttribute("aria-current")
    ).toBeNull()
  })

  it("shows the count of roles left to evaluate on the Roles tab", () => {
    // Three roles, one evaluated (has a band): two remain.
    setQueries([{ roleId: "r1" }, { roleId: "r2" }, { roleId: "r3" }], {
      rows: [{ roleId: "r1", band: 3 }],
    })
    renderTabs()
    expect(screen.getByLabelText("2 roles left to evaluate")).toBeDefined()
  })

  it("hides the badge while loading and when everything is evaluated", () => {
    setQueries(undefined, undefined)
    const { unmount } = renderTabs()
    expect(document.querySelector("number-flow-react")).toBeNull()
    unmount()

    setQueries([{ roleId: "r1" }], { rows: [{ roleId: "r1", band: 2 }] })
    renderTabs()
    expect(document.querySelector("number-flow-react")).toBeNull()
  })
})
