import messages from "@workspace/i18n/messages/en.json"
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type RunSummary = {
  runId: string
  slug: string
  label: string
  status: string
  referenceDate: number
  populationCount: number
  orgGapPct: number | null
}
let runsState: RunSummary[] | undefined
vi.mock("convex/react", () => ({
  useQuery: () => runsState,
}))
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", role: "admin" }),
}))
const pathState = { current: "/pay-mappings/run-2026" }
vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

import { RunFactsFooter } from "@/components/pay-mapping/run-facts-footer"

const run2026: RunSummary = {
  runId: "r1",
  slug: "run-2026",
  label: "2026",
  status: "open",
  referenceDate: 1,
  populationCount: 42,
  orgGapPct: 4.1,
}

function renderFooter() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RunFactsFooter />
    </NextIntlClientProvider>
  )
}

describe("RunFactsFooter", () => {
  beforeEach(() => {
    runsState = undefined
    pathState.current = "/pay-mappings/run-2026"
  })
  afterEach(() => cleanup())

  it("renders nothing while the runs list loads or when the slug matches no run", () => {
    expect(renderFooter().container.firstElementChild).toBeNull()
    cleanup()
    runsState = [run2026]
    pathState.current = "/pay-mappings/other-run"
    expect(renderFooter().container.firstElementChild).toBeNull()
  })

  it("shows the run's frozen population and gap", () => {
    runsState = [run2026]
    renderFooter()
    expect(
      screen.getByText(messages.dashboard.payMapping.runFacts)
    ).toBeTruthy()
    const population = screen.getByText(
      messages.dashboard.payMapping.table.population
    ).parentElement as HTMLElement
    expect(population.textContent).toContain("42")
    const gap = screen.getByText(
      messages.dashboard.payMapping.overview.headlineGapLabel
    ).parentElement as HTMLElement
    // percentText: unsigned, at most one fraction digit, en locale.
    expect(gap.textContent).toContain("4.1%")
  })

  it("drops the gap row when the run has no measurable org-level gap", () => {
    runsState = [{ ...run2026, orgGapPct: null }]
    renderFooter()
    expect(
      screen.queryByText(
        messages.dashboard.payMapping.overview.headlineGapLabel
      )
    ).toBeNull()
    expect(
      screen.getByText(messages.dashboard.payMapping.table.population)
    ).toBeTruthy()
  })
})
