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
  GenderPureDeepDive,
  genderPureStats,
  SingletonNote,
  WomenAheadGroups,
} from "@/components/pay-mapping/excluded-groups-sections"
import type {
  GenderPureGroupWire,
  PayMappingSnapshotRow,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import { makeExcluded, makeGapGroup } from "@/test/pay-mapping-fixtures"

const m = messages.dashboard.payMapping
const RUN_ID = "run-1" as Id<"payMappingRuns">

const GROUP: GenderPureGroupWire = {
  key: "Lead|1|Staff",
  roleTitle: "Lead",
  seniority: "Staff",
  level: 1,
  gender: "Man",
  count: 3,
}

function row(
  overrides: Partial<PayMappingSnapshotRow> & { personPublicId: string }
): PayMappingSnapshotRow {
  return {
    displayName: "Person",
    erased: false,
    gender: "Man",
    roleTitle: "Lead",
    trackKey: "ic",
    seniority: "Staff",
    level: 1,
    basicMonthly: 90000,
    components: [],
    currency: "SEK",
    payYear: 2026,
    ...overrides,
  }
}

const ROWS: PayMappingSnapshotRow[] = [
  row({ personPublicId: "m1", displayName: "Lars Lead", basicMonthly: 80000 }),
  row({ personPublicId: "m2", displayName: "Nils Nord", basicMonthly: 90000 }),
  row({ personPublicId: "m3", displayName: "Olof Ost", basicMonthly: 100000 }),
  // Another group entirely: never counted into this one's statistics.
  row({ personPublicId: "x", roleTitle: "Other", basicMonthly: 500000 }),
]

function renderDeepDive(rows: PayMappingSnapshotRow[] = ROWS) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <GenderPureDeepDive
        excluded={makeExcluded({ genderPure: [GROUP] })}
        rows={rows}
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

describe("genderPureStats", () => {
  it("computes the group's own spread from its FTE-adjusted base salaries", () => {
    const stats = genderPureStats(ROWS, GROUP)
    expect(stats?.count).toBe(3)
    expect(stats?.min).toBe(80000)
    expect(stats?.median).toBe(90000)
    expect(stats?.max).toBe(100000)
    // The 500k row belongs to another group and must not skew this one.
    expect(stats?.mean).toBe(90000)
  })

  it("grosses a part-timer up before comparing", () => {
    const stats = genderPureStats(
      [row({ personPublicId: "p", basicMonthly: 45000, ftePercent: 50 })],
      GROUP
    )
    expect(stats?.mean).toBe(90000)
  })
})

describe("GenderPureDeepDive", () => {
  afterEach(() => {
    cleanup()
  })

  // The open/close control lives on the supplementary drawer's accordion
  // now (Iteration 3), so this component renders its content directly.
  it("states what the analysis is, then the group's statistics and members", () => {
    renderDeepDive()
    expect(screen.getByText(m.deepDive.lead)).toBeDefined()
    expect(screen.getByText("Lars Lead")).toBeDefined()
    expect(screen.getByText(m.deepDive.stats.median)).toBeDefined()
    expect(screen.getByText(m.deepDive.stats.spread)).toBeDefined()
    // The other group's member never appears here.
    expect(screen.queryByText("SEK 500,000")).toBeNull()
  })

  it("offers notes but never a formal action (the backend rejects one)", async () => {
    renderDeepDive()
    fireEvent.click(
      screen.getByRole("button", {
        name: m.actions.menuLabel.replace("{target}", "Lead · Staff"),
      })
    )
    await waitFor(() => {
      expect(screen.getByText(m.actions.createNoteTitle)).toBeDefined()
    })
    expect(screen.queryByText(m.actions.createTitle)).toBeNull()
  })
})

describe("WomenAheadGroups", () => {
  afterEach(() => {
    cleanup()
  })

  it("lists the groups as information, with no flag anywhere", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <WomenAheadGroups
          excluded={makeExcluded({
            reverse: [
              makeGapGroup({
                key: "PM|2|Mid",
                roleTitle: "PM",
                seniority: "Mid",
                metric: {
                  womenMean: 110000,
                  menMean: 100000,
                  gapPct: -10,
                  gapKr: -10000,
                },
                flag: "ok",
              }),
            ],
          })}
          currency="SEK"
        />
      </NextIntlClientProvider>
    )
    expect(screen.getByText(m.womenAhead.lead)).toBeDefined()
    expect(screen.getByText("PM · Mid")).toBeDefined()
    // No severity chip: these groups carry no finding.
    for (const flag of Object.values(m.gap.flag)) {
      expect(screen.queryByText(flag)).toBeNull()
    }
  })
})

describe("SingletonNote", () => {
  afterEach(() => {
    cleanup()
  })

  it("explains why a one-person title carries no comparison", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SingletonNote />
      </NextIntlClientProvider>
    )
    // The count itself lives in the drawer item's meta slot; the body says
    // why, and that the people still count everywhere else.
    expect(
      screen.getByText(
        messages.dashboard.payMapping.supplementary.body.singletons
      )
    ).toBeDefined()
  })
})
