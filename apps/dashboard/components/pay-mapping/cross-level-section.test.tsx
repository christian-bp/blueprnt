import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
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

import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import {
  buildCrossLevelCases,
  CrossLevelSection,
} from "@/components/pay-mapping/cross-level-section"
import type { PayMappingSnapshotRow } from "@/components/pay-mapping/pay-mapping-gap-types"

const m = messages.dashboard.payMapping.crossLevel

const RUN_ID = "run-1" as Id<"payMappingRuns">

function row(
  overrides: Partial<PayMappingSnapshotRow> & { personPublicId: string }
): PayMappingSnapshotRow {
  return {
    displayName: "Person",
    erased: false,
    gender: "Man",
    roleTitle: "SWE",
    trackKey: "ic",
    seniority: "Senior",
    level: 3,
    basicMonthly: 50000,
    components: [],
    currency: "SEK",
    payYear: 2026,
    ...overrides,
  }
}

// Anna sits on level 3 (higher value) at 61k; Erik and Jonas sit on level 4
// (lower value) and both out-earn her. Sam is on level 4 but earns less, so
// he is not a case. Nina is on level 4 and out-earned by nobody below her.
const ROWS: PayMappingSnapshotRow[] = [
  row({
    personPublicId: "anna",
    displayName: "Anna Svensson",
    gender: "Kvinna",
    level: 3,
    basicMonthly: 61000,
  }),
  row({
    personPublicId: "erik",
    displayName: "Erik Johansson",
    level: 4,
    basicMonthly: 65000,
  }),
  row({
    personPublicId: "jonas",
    displayName: "Jonas Bergström",
    level: 4,
    basicMonthly: 62000,
    trackKey: "manager",
  }),
  row({
    personPublicId: "sam",
    displayName: "Sam Sund",
    level: 4,
    basicMonthly: 58000,
  }),
  row({
    personPublicId: "nina",
    displayName: "Nina Nord",
    gender: "Kvinna",
    level: 4,
    basicMonthly: 70000,
  }),
]

function renderSection(
  props: Partial<Parameters<typeof CrossLevelSection>[0]> = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CrossLevelSection
        rows={ROWS}
        currency="SEK"
        documentation={{
          runId: RUN_ID,
          actions: [],
          notes: [],
          locked: false,
        }}
        {...props}
      />
    </NextIntlClientProvider>
  )
}

describe("buildCrossLevelCases", () => {
  it("joins the engine's pseudonymous cases to their display names", () => {
    const cases = buildCrossLevelCases(ROWS)
    expect(cases).toHaveLength(1)
    expect(cases[0]?.personPublicId).toBe("anna")
    expect(cases[0]?.womanName).toBe("Anna Svensson")
    expect(cases[0]?.outEarnedByCount).toBe(2)
    // Worst pair first: Erik's 4000 beats Jonas's 1000.
    expect(cases[0]?.worstPair.manPublicId).toBe("erik")
    expect(cases[0]?.worstPair.diffKr).toBe(4000)
  })

  it("FTE-adjusts base salary before comparing", () => {
    // A 50% woman at 32k grosses to 64k, which clears both level-4 men.
    const cases = buildCrossLevelCases([
      row({
        personPublicId: "part",
        displayName: "Petra",
        gender: "Kvinna",
        level: 3,
        basicMonthly: 32000,
        ftePercent: 50,
      }),
      row({ personPublicId: "m", level: 4, basicMonthly: 63000 }),
    ])
    expect(cases).toHaveLength(0)
  })

  it("skips rows without a level or a salary", () => {
    const cases = buildCrossLevelCases([
      row({
        personPublicId: "w",
        gender: "Kvinna",
        level: null,
        basicMonthly: 40000,
      }),
      row({ personPublicId: "m", level: 4, basicMonthly: 60000 }),
      row({
        personPublicId: "w2",
        gender: "Kvinna",
        level: 2,
        basicMonthly: null,
      }),
    ])
    expect(cases).toHaveLength(0)
  })
})

describe("CrossLevelSection", () => {
  afterEach(() => {
    cleanup()
  })

  it("leads with the case count and the affected woman, pairs collapsed", () => {
    renderSection()
    // The ICU plural renders its "one" branch for a single case.
    expect(screen.getByText("1 cross-level case")).toBeDefined()
    expect(screen.getByText("Anna Svensson")).toBeDefined()
    // The pair rows stay behind the disclosure.
    expect(screen.queryByText("Erik Johansson")).toBeNull()
  })

  it("expands to the full pair list, worst first, marking a same-track pair", async () => {
    renderSection()
    fireEvent.click(screen.getByRole("button", { name: m.showPairs }))
    await waitFor(() => {
      expect(screen.getByText("Erik Johansson")).toBeDefined()
    })
    expect(screen.getByText("Jonas Bergström")).toBeDefined()
    // Sam earns less than Anna: never a pair.
    expect(screen.queryByText("Sam Sund")).toBeNull()
    // Erik shares Anna's track (ic); Jonas is a manager, so only one chip.
    expect(screen.getAllByText(m.sameTrack)).toHaveLength(1)
  })

  it("states the compliance-positive result in words when there is no case", () => {
    renderSection({ rows: [ROWS[1] as PayMappingSnapshotRow] })
    expect(screen.getByText(m.none)).toBeDefined()
  })

  it("renders nothing at all when hidden-when-empty (the steady-state summary)", () => {
    const { container } = renderSection({
      rows: [ROWS[1] as PayMappingSnapshotRow],
      hideWhenEmpty: true,
    })
    expect(container.textContent).toBe("")
  })
})
