import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"

import {
  buildMemberRows,
  GroupMemberTable,
} from "@/components/pay-mapping/group-member-table"
import type { PayMappingSnapshotRow } from "@/components/pay-mapping/pay-mapping-gap-types"
import { makeGapGroup } from "@/test/pay-mapping-fixtures"

const m = messages.dashboard.payMapping

// Rows matching the default fixture group's identity (SWE · Senior · level 3).
function memberRow(
  overrides: Partial<PayMappingSnapshotRow> = {}
): PayMappingSnapshotRow {
  return {
    personPublicId: "p1",
    displayName: "Person",
    erased: false,
    gender: "Man",
    roleTitle: "SWE",
    trackKey: "IC",
    seniority: "Senior",
    level: 3,
    basicMonthly: 100000,
    components: [],
    currency: "SEK",
    payYear: 2026,
    ...overrides,
  }
}

function renderTable(props: Parameters<typeof GroupMemberTable>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <GroupMemberTable {...props} />
    </NextIntlClientProvider>
  )
}

// Rendered first-column texts, in row order.
function renderedNames(): string[] {
  const table = screen.getByRole("table")
  return within(table)
    .getAllByRole("row")
    .slice(1) // skip the header row
    .map((row) => within(row).getAllByRole("cell")[0]?.textContent ?? "")
}

describe("buildMemberRows", () => {
  it("FTE-adjusts base and tcc, and diffs against the men's base mean", () => {
    const group = makeGapGroup({
      base: { womenMean: 50000, menMean: 100000, gapPct: 50, gapKr: 50000 },
    })
    const rows = buildMemberRows(
      [
        memberRow({
          displayName: "Wilma",
          gender: "Kvinna",
          basicMonthly: 25000,
          ftePercent: 50,
          components: [{ kind: "bonus", monthlyAmount: 5000 }],
        }),
      ],
      group
    )
    expect(rows).toHaveLength(1)
    const row = rows[0]
    // 25k at 50% FTE grosses to 50k base; the 5k bonus grosses to 10k on top.
    expect(row?.base).toBe(50000)
    expect(row?.tcc).toBe(60000)
    expect(row?.ftePercent).toBe(50)
    // Diff on the PRIMARY metric (base): 50k - 100k men mean.
    expect(row?.diffKr).toBe(-50000)
    expect(row?.diffPct).toBe(-50)
  })

  it("diffs against the men's tcc mean for a tccDriven group", () => {
    const group = makeGapGroup({
      base: { womenMean: 100000, menMean: 100000, gapPct: 0, gapKr: 0 },
      tcc: { womenMean: 100000, menMean: 110000, gapPct: 9.09, gapKr: 10000 },
      tccDriven: true,
    })
    const rows = buildMemberRows(
      [memberRow({ gender: "Kvinna", basicMonthly: 100000 })],
      group
    )
    // The member's tcc (100k, no components) against the men's tcc mean 110k.
    expect(rows[0]?.diffKr).toBe(-10000)
  })

  it("nulls the diff when the men's mean is missing", () => {
    const group = makeGapGroup({
      metric: { womenMean: 50000, menMean: null, gapPct: null, gapKr: null },
    })
    const rows = buildMemberRows([memberRow({ gender: "Kvinna" })], group)
    expect(rows[0]?.diffKr).toBeNull()
    expect(rows[0]?.diffPct).toBeNull()
  })
})

describe("GroupMemberTable", () => {
  afterEach(() => {
    cleanup()
  })

  const GROUP = makeGapGroup()

  const ROWS: PayMappingSnapshotRow[] = [
    memberRow({ displayName: "Mats", gender: "Man", basicMonthly: 100000 }),
    memberRow({ displayName: "Wilma", gender: "Kvinna", basicMonthly: 95000 }),
    memberRow({ displayName: "Anna", gender: "Kvinna", basicMonthly: 90000 }),
    memberRow({ displayName: "Erik", gender: "Man", basicMonthly: 98000 }),
    // Outside the group's identity: never rendered.
    memberRow({ displayName: "Other", roleTitle: "Other" }),
  ]

  it("defaults to women first, lowest base salary on top, and scopes to the group's members", () => {
    renderTable({ group: GROUP, rows: ROWS, currency: "SEK" })
    expect(renderedNames()).toEqual(["Anna", "Wilma", "Erik", "Mats"])
    expect(screen.queryByText("Other")).toBeNull()
  })

  it("re-sorts freely: the base heading flips to descending across genders, the name heading sorts alphabetically", () => {
    renderTable({ group: GROUP, rows: ROWS, currency: "SEK" })
    // Base already participates in the default sort (ascending), so the
    // first click flips it to descending, now across both genders.
    fireEvent.click(
      screen.getByRole("button", { name: m.detail.columns.basePay })
    )
    expect(renderedNames()).toEqual(["Mats", "Erik", "Wilma", "Anna"])
    // A fresh column starts ascending and replaces the sort entirely.
    fireEvent.click(screen.getByRole("button", { name: m.detail.columns.name }))
    expect(renderedNames()).toEqual(["Anna", "Erik", "Mats", "Wilma"])
  })

  it("marks part-time rows with their FTE share next to the grossed-up base", () => {
    renderTable({
      group: GROUP,
      rows: [
        memberRow({
          displayName: "Petra",
          gender: "Kvinna",
          basicMonthly: 45000,
          ftePercent: 50,
        }),
      ],
      currency: "SEK",
    })
    expect(
      screen.getByText(m.detail.fteShare.replace("{fte}", "50"))
    ).toBeDefined()
  })

  it("paginates past 25 rows with a full first page", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      memberRow({
        displayName: `Person ${String(i).padStart(2, "0")}`,
        basicMonthly: 50000 + i * 100,
      })
    )
    renderTable({ group: GROUP, rows: many, currency: "SEK" })
    expect(renderedNames()).toHaveLength(25)
    expect(screen.getByRole("navigation")).toBeDefined()
  })

  it("renders no pagination at 25 rows or fewer", () => {
    renderTable({ group: GROUP, rows: ROWS, currency: "SEK" })
    expect(screen.queryByRole("navigation")).toBeNull()
  })
})
