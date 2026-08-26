import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: "admin" }),
}))
let pathname = "/pay-mappings/pay-2026/analysis/praxis"
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}))

import { RunSidebar } from "@/components/pay-mapping/run-sidebar"
import { onQuery } from "@/test/convex-mocks"

const m = messages.dashboard.payMapping

const RUN = { runId: "run-1", slug: "pay-2026", label: "2026", status: "open" }

function renderSidebar() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RunSidebar />
    </NextIntlClientProvider>
  )
}

// The run sidebar is the run workspace's whole navigation, so the analysis
// chapters live here (the in-page tab row is gone): indented under Analys,
// always visible, each linking straight at its own page.
describe("RunSidebar analysis chapters", () => {
  beforeEach(() => {
    pathname = "/pay-mappings/pay-2026/analysis/praxis"
    onQuery((ref) => {
      if (ref === "payMapping.runs.getPayMappingRunBySlug") return RUN
      if (ref === "payMapping.runs.listPayMappingRuns") return [RUN]
      return undefined
    })
  })
  afterEach(() => cleanup())

  it("lists every chapter under Analys, linking at its own page", () => {
    renderSidebar()
    for (const [key, segment] of [
      ["start", "start"],
      ["praxis", "praxis"],
      ["equalWork", "equal-work"],
      ["equivalentWork", "equivalent-work"],
    ] as const) {
      const link = screen.getByRole("button", {
        name: m.review.chaptersShort[key],
      })
      expect(link.getAttribute("href")).toBe(
        `/pay-mappings/pay-2026/analysis/${segment}`
      )
    }
  })

  // One current row: the open chapter carries aria-current, and the Analys
  // parent stands down while a chapter page is open (its landing is only the
  // redirect into the first chapter, never a page of its own).
  it("marks the open chapter current, not the Analys parent", () => {
    renderSidebar()
    const chapter = screen.getByRole("button", {
      name: m.review.chaptersShort.praxis,
    })
    expect(chapter.getAttribute("aria-current")).toBe("page")
    const parent = screen.getByRole("button", { name: m.tabs.analysis })
    expect(parent.getAttribute("aria-current")).toBeNull()
  })

  // Off the analysis section the parent rows behave as before: the open
  // sub-page's own row is the current one.
  it("keeps the other sub-pages' rows current on their own pages", () => {
    pathname = "/pay-mappings/pay-2026/actions"
    renderSidebar()
    const actions = screen.getByRole("button", { name: m.tabs.actions })
    expect(actions.getAttribute("aria-current")).toBe("page")
    expect(
      screen
        .getByRole("button", { name: m.review.chaptersShort.praxis })
        .getAttribute("aria-current")
    ).toBeNull()
  })
})
