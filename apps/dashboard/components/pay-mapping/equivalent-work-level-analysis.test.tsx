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
import { EquivalentWorkLevelAnalysis } from "@/components/pay-mapping/equivalent-work-level-analysis"
import {
  type GapGroup,
  levelMembers,
  meetsEntryConditions,
  type PayMappingSnapshotRow,
  shownEqualWorkKeyFor,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import { makeGapGroup } from "@/test/pay-mapping-fixtures"

const m = messages.dashboard.payMapping
const RUN_ID = "run-1" as Id<"payMappingRuns">

function row(
  overrides: Partial<PayMappingSnapshotRow> & { personPublicId: string }
): PayMappingSnapshotRow {
  return {
    displayName: "Person",
    erased: false,
    gender: "Man",
    roleTitle: "Analyst",
    trackKey: "IC",
    seniority: "Mid",
    level: 2,
    basicMonthly: 50000,
    components: [],
    currency: "SEK",
    payYear: 2026,
    ...overrides,
  }
}

// Level 2 qualifies (2 women + 1 man, women behind). Anna's equal-work
// group (Analyst) is SHOWN; Karin's (Designer) is a singleton, so she takes
// no formal documentation from here. Sven on level 3 (lower value) earns
// 50k, out-earning both level-2 women: both carry the tvärnivå flag.
const ROWS: PayMappingSnapshotRow[] = [
  row({
    personPublicId: "w1",
    displayName: "Anna Ask",
    gender: "Kvinna",
    basicMonthly: 45000,
  }),
  row({
    personPublicId: "w2",
    displayName: "Karin Karlsson",
    gender: "Kvinna",
    roleTitle: "Designer",
    trackKey: "Lead",
    basicMonthly: 40000,
  }),
  row({ personPublicId: "m1", displayName: "Erik Ek", basicMonthly: 50000 }),
  row({
    personPublicId: "m2",
    displayName: "Sven Svan",
    roleTitle: "Support",
    seniority: "Junior",
    level: 3,
    basicMonthly: 50000,
  }),
]

const LEVEL_2: GapGroup = makeGapGroup({
  key: "2",
  roleTitle: null,
  seniority: null,
  level: 2,
  womenCount: 2,
  menCount: 1,
  base: { womenMean: 42500, menMean: 50000, gapPct: 15, gapKr: 7500 },
  flag: "critical",
})

// One gender only: never a section here.
const LEVEL_3: GapGroup = makeGapGroup({
  key: "3",
  roleTitle: null,
  seniority: null,
  level: 3,
  womenCount: 0,
  menCount: 1,
  metric: { womenMean: null, menMean: 50000, gapPct: null, gapKr: null },
  flag: "insufficient",
})

const SHOWN_EQUAL_WORK: GapGroup[] = [
  makeGapGroup({
    key: "Analyst|2|Mid",
    roleTitle: "Analyst",
    seniority: "Mid",
    level: 2,
    womenCount: 1,
    menCount: 1,
  }),
]

function renderAnalysis() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <EquivalentWorkLevelAnalysis
        equivalentWork={[LEVEL_2, LEVEL_3]}
        equalWork={SHOWN_EQUAL_WORK}
        rows={ROWS}
        currency="SEK"
        documentation={{
          runId: RUN_ID,
          actions: [],
          notes: [],
          locked: false,
        }}
      />
    </NextIntlClientProvider>
  )
}

describe("level-analysis helpers", () => {
  it("meetsEntryConditions mirrors the shown outcome", () => {
    expect(meetsEntryConditions(LEVEL_2)).toBe(true)
    expect(meetsEntryConditions(LEVEL_3)).toBe(false)
    // Women ahead on both metrics: not shown.
    expect(
      meetsEntryConditions(
        makeGapGroup({
          metric: {
            womenMean: 55000,
            menMean: 50000,
            gapPct: -10,
            gapKr: -5000,
          },
        })
      )
    ).toBe(false)
    // The TCC-driven admission also opens the level view.
    expect(
      meetsEntryConditions(
        makeGapGroup({
          base: { womenMean: 50000, menMean: 50000, gapPct: 0, gapKr: 0 },
          tcc: { womenMean: 50000, menMean: 55000, gapPct: 9, gapKr: 5000 },
        })
      )
    ).toBe(true)
  })

  it("levelMembers takes every priced row on the level, across roles", () => {
    expect(levelMembers(ROWS, 2).map((r) => r.personPublicId)).toEqual([
      "w1",
      "w2",
      "m1",
    ])
    expect(
      levelMembers([row({ personPublicId: "x", basicMonthly: null })], 2)
    ).toEqual([])
  })

  it("shownEqualWorkKeyFor resolves only members of shown groups", () => {
    expect(
      shownEqualWorkKeyFor(
        { roleTitle: "Analyst", seniority: "Mid", level: 2 },
        SHOWN_EQUAL_WORK
      )
    ).toBe("Analyst|2|Mid")
    expect(
      shownEqualWorkKeyFor(
        { roleTitle: "Designer", seniority: "Mid", level: 2 },
        SHOWN_EQUAL_WORK
      )
    ).toBeNull()
  })
})

describe("EquivalentWorkLevelAnalysis", () => {
  afterEach(() => {
    cleanup()
  })

  it("is collapsed by default but states what it is", () => {
    renderAnalysis()
    expect(screen.getByText(m.levelAnalysis.lead)).toBeDefined()
    expect(screen.queryByText("Anna Ask")).toBeNull()
  })

  it("opens to one section per qualifying level with track, role and flags", async () => {
    renderAnalysis()
    fireEvent.click(screen.getByRole("button", { name: m.levelAnalysis.show }))
    await waitFor(() => {
      expect(screen.getByText("Anna Ask")).toBeDefined()
    })
    // Level 3 is gender-pure: its lone member never gets a section of his
    // own (he appears only as Anna's cross-level counterpart elsewhere).
    expect(screen.queryByText("Sven Svan")).toBeNull()
    // The level variant's extra columns (Anna and Erik share the Analyst
    // role, so their role cells render the same text).
    expect(screen.getAllByText("Analyst · Mid")).toHaveLength(2)
    expect(screen.getByText("Designer · Mid")).toBeDefined()
    // Both level-2 women are out-earned from level 3: the tvärnivå flag.
    expect(screen.getAllByText(m.detail.crossLevelFlagged)).toHaveLength(2)
  })

  it("offers documentation only to members of shown equal-work groups", async () => {
    renderAnalysis()
    fireEvent.click(screen.getByRole("button", { name: m.levelAnalysis.show }))
    await waitFor(() => {
      expect(screen.getByText("Anna Ask")).toBeDefined()
    })
    expect(
      screen.getByRole("button", {
        name: m.actions.menuLabel.replace("{target}", "Anna Ask"),
      })
    ).toBeDefined()
    // Karin's own group is a singleton: no formal documentation from here.
    expect(
      screen.queryByRole("button", {
        name: m.actions.menuLabel.replace("{target}", "Karin Karlsson"),
      })
    ).toBeNull()
  })

  it("renders nothing when no level qualifies", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <EquivalentWorkLevelAnalysis
          equivalentWork={[LEVEL_3]}
          equalWork={[]}
          rows={ROWS}
          currency="SEK"
        />
      </NextIntlClientProvider>
    )
    expect(container.textContent).toBe("")
  })
})
