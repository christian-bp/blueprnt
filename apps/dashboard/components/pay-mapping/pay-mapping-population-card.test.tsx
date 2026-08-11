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

  // The comparison is ONE visible sentence carrying its own amount, not a
  // pill in the corner plus a "vs 2025" fragment that only meant something
  // together with it (and so needed a screen-reader-only rewrite).
  it("states the change with its amount and names the mapping it is measured against", () => {
    renderCard({ runsList: [PREVIOUS_2025] })
    expect(screen.getByText("3 people more than 2025")).toBeDefined()
    // No delta pill, and no fragment left over from one.
    expect(screen.queryByText("+3")).toBeNull()
    expect(screen.queryByText("vs 2025")).toBeNull()
  })

  it("states a shrinking population as fewer", () => {
    renderCard({
      runsList: [makeRunSummary({ label: "2025", populationCount: 130 })],
    })
    expect(screen.getByText("9 people fewer than 2025")).toBeDefined()
    expect(screen.queryByText("-9")).toBeNull()
  })

  // The statement is visible to everyone: the sentence a screen reader used
  // to get privately is now the line on screen, so there is exactly one copy
  // of it in the tree.
  it("renders the comparison once, not as a visible half plus a hidden sentence", () => {
    renderCard({ runsList: [PREVIOUS_2025] })
    expect(screen.getAllByText("3 people more than 2025")).toHaveLength(1)
  })

  it("says what the figure covers under the comparison", () => {
    renderCard({ runsList: [PREVIOUS_2025] })
    expect(screen.getByText(m.overview.populationNote)).toBeDefined()
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
