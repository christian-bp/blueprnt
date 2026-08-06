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

  it("is closed by default, but always states what it is first", () => {
    renderDeepDive()
    expect(screen.getByText(m.deepDive.lead)).toBeDefined()
    expect(screen.getByText("1 gender-pure group")).toBeDefined()
    // Nothing of the analysis itself until the user opts in.
    expect(screen.queryByText("Lars Lead")).toBeNull()
  })

  it("opens on demand to the group's statistics and its members", async () => {
    renderDeepDive()
    fireEvent.click(screen.getByRole("button", { name: m.deepDive.show }))
    await waitFor(() => {
      expect(screen.getByText("Lars Lead")).toBeDefined()
    })
    expect(screen.getByText(m.deepDive.stats.median)).toBeDefined()
    expect(screen.getByText(m.deepDive.stats.spread)).toBeDefined()
    // The other group's member never appears here.
    expect(screen.queryByText("SEK 500,000")).toBeNull()
  })

  it("offers notes but never a formal action (the backend rejects one)", async () => {
    renderDeepDive()
    fireEvent.click(screen.getByRole("button", { name: m.deepDive.show }))
    await waitFor(() => {
      expect(screen.getByText("Lars Lead")).toBeDefined()
    })
    fireEvent.click(
      screen.getByRole("button", {
        name: m.actions.menuLabel.replace("{target}", "Lead · Staff"),
      })
    )
    expect(screen.getByText(m.actions.createNoteTitle)).toBeDefined()
    expect(screen.queryByText(m.actions.createTitle)).toBeNull()
  })

  it("renders nothing when no group is gender-pure", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <GenderPureDeepDive
          excluded={makeExcluded()}
          rows={ROWS}
          currency="SEK"
        />
      </NextIntlClientProvider>
    )
    expect(container.textContent).toBe("")
  })
})

describe("WomenAheadGroups", () => {
  afterEach(() => {
    cleanup()
  })

  it("lists the groups as information, with no flag anywhere", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: m.womenAhead.show }))
    await waitFor(() => {
      expect(screen.getByText("PM · Mid")).toBeDefined()
    })
    // No severity chip: these groups carry no finding.
    for (const flag of Object.values(m.gap.flag)) {
      expect(screen.queryByText(flag)).toBeNull()
    }
  })

  it("renders nothing when no group has the women ahead", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <WomenAheadGroups excluded={makeExcluded()} currency="SEK" />
      </NextIntlClientProvider>
    )
    expect(container.textContent).toBe("")
  })
})

describe("SingletonNote", () => {
  afterEach(() => {
    cleanup()
  })

  it("states how many one-person groups were dropped, and why", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SingletonNote excluded={makeExcluded({ singletonCount: 42 })} />
      </NextIntlClientProvider>
    )
    expect(screen.getByText(/42 groups with a single person/)).toBeDefined()
  })

  it("says nothing when no group was dropped", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SingletonNote excluded={makeExcluded()} />
      </NextIntlClientProvider>
    )
    expect(container.textContent).toBe("")
  })
})
