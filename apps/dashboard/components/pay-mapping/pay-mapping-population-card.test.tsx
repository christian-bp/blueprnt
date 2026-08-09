import { cleanup, render, screen } from "@testing-library/react"
import en from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

// The card reads the run + run list from context only; the provider builds
// the review queue from them, which needs the analyses/gap queries mocked.
vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

import { makeRunDetail, makeRunSummary } from "@/test/pay-mapping-fixtures"
import { PayMappingPopulationCard } from "./pay-mapping-population-card"
import {
  PayMappingRunProvider,
  type PayMappingRunSummary,
} from "./pay-mapping-run-context"

const m = en.dashboard.payMapping

const RUN = makeRunDetail({
  label: "2026",
  referenceDate: Date.UTC(2026, 0, 1),
  populationCount: 121,
})

function renderCard(
  overrides: {
    run?: ReturnType<typeof makeRunDetail> | undefined
    runsList?: PayMappingRunSummary[] | undefined
  } = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PayMappingRunProvider
        value={{
          run: "run" in overrides ? overrides.run : RUN,
          gap: undefined,
          analyses: undefined,
          actions: [],
          notes: [],
          runsList: "runsList" in overrides ? overrides.runsList : [],
        }}
      >
        <PayMappingPopulationCard />
      </PayMappingRunProvider>
    </NextIntlClientProvider>
  )
}

const PREVIOUS_2025 = makeRunSummary({
  label: "2025",
  referenceDate: Date.UTC(2025, 0, 1),
  populationCount: 118,
})

afterEach(() => cleanup())

describe("PayMappingPopulationCard", () => {
  it("leads with this mapping's frozen headcount", () => {
    renderCard()
    expect(screen.getByText(m.detail.population)).toBeDefined()
    expect(screen.getByText("121")).toBeDefined()
  })

  it("shows the signed delta and names the mapping it is measured against", () => {
    renderCard({ runsList: [PREVIOUS_2025] })
    expect(screen.getByText("+3")).toBeDefined()
    expect(screen.getByText("vs 2025")).toBeDefined()
  })

  it("signs a shrinking population negative", () => {
    renderCard({
      runsList: [makeRunSummary({ label: "2025", populationCount: 130 })],
    })
    expect(screen.getByText("-9")).toBeDefined()
  })

  // The pill and the "vs 2025" fragment mean nothing apart when read out, so
  // the accessible text is one sentence and the visual halves are hidden.
  it("reads the comparison out as a single sentence", () => {
    renderCard({ runsList: [PREVIOUS_2025] })
    expect(screen.getByText("3 people more than 2025")).toBeDefined()
  })

  it("says first mapping instead of a delta when there is no earlier run", () => {
    renderCard({ runsList: [] })
    expect(screen.getByText(m.overview.populationFirstRun)).toBeDefined()
    expect(screen.queryByText(/^\+/)).toBeNull()
  })

  // A population that did not move is a different statement from having
  // nothing to compare against, so it gets its own line rather than a "+0".
  it("distinguishes an unchanged population from a first mapping", () => {
    renderCard({
      runsList: [makeRunSummary({ label: "2025", populationCount: 121 })],
    })
    expect(screen.getByText("Unchanged vs 2025")).toBeDefined()
    expect(screen.queryByText(m.overview.populationFirstRun)).toBeNull()
  })

  it("renders its real title while the run loads", () => {
    renderCard({ run: undefined, runsList: undefined })
    expect(screen.getByText(m.detail.population)).toBeDefined()
    expect(
      document.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
  })
})
