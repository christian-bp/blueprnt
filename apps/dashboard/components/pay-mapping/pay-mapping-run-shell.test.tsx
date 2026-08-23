import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

const pathState = vi.hoisted(() => ({
  current: "/pay-mappings/pay-2026",
}))

// The shell derives the sub-page title from the pathname.
vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

// The shell issues the run + gap queries directly; mock convex/react + the
// generated api like pay-comparison-section.test.tsx so useQuery resolves
// without a live ConvexProvider, and org-context for the orgId.
vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", role: "admin" }),
}))

import type { PayMappingRunDetail } from "@/components/pay-mapping/pay-mapping-gap-types"
import { PayMappingRunShell } from "@/components/pay-mapping/pay-mapping-run-shell"
import { onQuery } from "@/test/convex-mocks"
import { makeRunDetail } from "@/test/pay-mapping-fixtures"

const m = messages.dashboard.payMapping

const RUN: PayMappingRunDetail = makeRunDetail({
  runId: "run1" as PayMappingRunDetail["runId"],
  label: "Lonekartlaggning 2026",
})

// Swapped per test: the run query's result (undefined = loading, null = not
// found). The gap query is skipped until the run resolves and its value is
// only forwarded to the pages, so the shell tests leave it undefined. The
// analyses query resolves to [] once the run is loaded, and stays undefined
// (loading) while the run itself is still loading.
const state: {
  run: PayMappingRunDetail | null | undefined
  analyses: unknown[] | undefined
} = { run: RUN, analyses: [] }

onQuery((ref) => {
  if (ref === "payMapping.runs.getPayMappingRunBySlug") return state.run
  if (ref === "payMapping.analyses.listGroupAnalyses") return state.analyses
  return undefined
})

function renderShell() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayMappingRunShell slug="pay-2026">
        <p>probe-child</p>
      </PayMappingRunShell>
    </NextIntlClientProvider>
  )
}

afterEach(() => {
  cleanup()
  state.run = RUN
  state.analyses = []
  pathState.current = "/pay-mappings/pay-2026"
})

describe("PayMappingRunShell", () => {
  it("renders the breadcrumb trail: list, run label, sub-page", () => {
    renderShell()
    // The run sidebar owns the workspace's navigation; this row names where
    // the visitor stands: Pay mappings (a link back) / the run / the
    // sub-page (the run index is the Overview).
    expect(screen.getByRole("heading", { name: m.tabs.overview })).toBeDefined()
    expect(screen.getByText("probe-child")).toBeDefined()
    expect(screen.getByText(RUN.label)).toBeDefined()
    const back = screen
      .getAllByRole("link")
      .find((link) => link.getAttribute("href") === "/pay-mappings")
    expect(back).toBeDefined()
  })

  it("titles the page after the active sub-page", () => {
    pathState.current = "/pay-mappings/pay-2026/analysis"
    renderShell()
    expect(screen.getByRole("heading", { name: m.tabs.analysis })).toBeDefined()
    expect(screen.queryByRole("heading", { name: m.tabs.overview })).toBeNull()
  })

  it("renders the breadcrumb-row chrome on every sub-page", () => {
    pathState.current = "/pay-mappings/pay-2026/analysis"
    renderShell()
    expect(screen.getByRole("heading", { name: m.tabs.analysis })).toBeDefined()
    expect(screen.getByText("probe-child")).toBeDefined()
  })

  it("shows not-found instead of the sub-page for an unknown slug", () => {
    state.run = null
    renderShell()
    expect(screen.getByText(m.detail.notFound)).toBeDefined()
    expect(screen.queryByText("probe-child")).toBeNull()
  })

  it("keeps the sub-page mounted while the run loads (pages own their skeletons)", () => {
    state.run = undefined
    renderShell()
    expect(screen.getByText("probe-child")).toBeDefined()
    expect(screen.queryByText(RUN.label)).toBeNull()
  })

  it("renders once the analyses (documentation rows) have loaded", () => {
    state.analyses = []
    renderShell()
    expect(screen.getByText("probe-child")).toBeDefined()
  })

  it("keeps the sub-page mounted while the analyses query loads", () => {
    state.analyses = undefined
    renderShell()
    expect(screen.getByText("probe-child")).toBeDefined()
  })
})
