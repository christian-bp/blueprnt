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

  // The mark family follows the surface, not the component: this table is the
  // evidence behind the scatter above it, so a person is a triangle or a
  // circle here exactly as they are in the plot. It drew the area charts' key
  // (a solid or hatched square) once, which made one surface show the same
  // person as two different shapes.
  it("marks gender with the point mark the plot above it uses", () => {
    const { container } = renderTable({
      group: GROUP,
      rows: ROWS,
      currency: "SEK",
    })
    const cells = [...container.querySelectorAll("tbody tr")].map(
      (row) => row.querySelectorAll("td")[1]
    )
    // Women are triangles (a path), men squares (a rect): both point marks,
    // and neither is a circle, which is the app's ungendered point.
    expect(cells[0]?.querySelector("svg path")).not.toBeNull()
    expect(cells[0]?.querySelector("svg rect")).toBeNull()
    const men = cells[cells.length - 1]
    expect(men?.querySelector("svg rect")).not.toBeNull()
    for (const cell of cells) {
      expect(cell?.querySelector("svg circle")).toBeNull()
    }
    // A CSS-painted swatch is what the area-chart key uses; nothing here may
    // carry one.
    for (const cell of cells) {
      expect(cell?.querySelector("span[style]")).toBeNull()
    }
  })

  function manyMembers(count: number) {
    return Array.from({ length: count }, (_, i) =>
      memberRow({
        displayName: `Person ${String(i).padStart(2, "0")}`,
        basicMonthly: 50000 + i * 100,
      })
    )
  }

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

  it("renders the difference as one column carrying both kr and percent", () => {
    renderTable({ group: GROUP, rows: ROWS, currency: "SEK" })
    // Two separate columns pushed the documentation control off the
    // analysis pane's visible width, so the difference reads as one value.
    const cells = Array.from(document.querySelectorAll("td")).map(
      (cell) => cell.textContent ?? ""
    )
    // "-SEK 10,000 (-10%)": the amount and its percent in one cell. Intl
    // puts a non-breaking space after the currency code, so normalize first.
    expect(
      cells.some((text) =>
        /SEK [\d,]+ \(-?\d+%\)$/.test(text.replace(/\s+/g, " ").trim())
      )
    ).toBe(true)
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

  // Five rows a page, not the registers' 25: this table sits ABOVE the plot,
  // so its height is what a reader scrolls past to reach the chart and the
  // form under it. A 30-person group at 25 rows pushed both off the screen.
  it("shows a short page and pages the rest", () => {
    renderTable({ group: GROUP, rows: manyMembers(30), currency: "SEK" })
    expect(renderedNames()).toHaveLength(5)
    expect(screen.getByRole("navigation")).toBeDefined()
  })

  it("renders no pagination for a group that fits on one page", () => {
    renderTable({ group: GROUP, rows: ROWS, currency: "SEK" })
    expect(screen.queryByRole("navigation")).toBeNull()
  })

  // With five rows a page, paging to a particular person is no way to find
  // them: the search is. It narrows on the name, which is the only thing that
  // tells rows in an equal-work group apart (they share a role by definition).
  it("narrows to the searched name and reports how many matched", () => {
    renderTable({ group: GROUP, rows: manyMembers(30), currency: "SEK" })
    fireEvent.change(screen.getByLabelText(m.detail.searchPlaceholder), {
      target: { value: "Person 07" },
    })
    expect(renderedNames()).toEqual(["Person 07"])
    expect(
      screen.getByText(
        m.detail.resultCount.replace("{shown}", "1").replace("{total}", "30")
      )
    ).toBeDefined()
    // Nothing to page through once one person matches.
    expect(screen.queryByRole("navigation")).toBeNull()
  })

  // The count is chrome the reader did not ask for until they start
  // narrowing, and a group that fits on a page should carry none of it.
  it("hides the count until the search is narrowing", () => {
    renderTable({ group: GROUP, rows: manyMembers(30), currency: "SEK" })
    expect(screen.queryByText(/of 30 people/)).toBeNull()
  })

  // An empty table under its own headings reads as a load that failed.
  it("says so in the table when nothing matches", () => {
    renderTable({ group: GROUP, rows: manyMembers(30), currency: "SEK" })
    fireEvent.change(screen.getByLabelText(m.detail.searchPlaceholder), {
      target: { value: "nobody" },
    })
    // The one row left IS the message, in the table's own first column, so
    // the headings keep their place instead of standing over nothing.
    expect(renderedNames()).toEqual([m.detail.noMatches])
  })

  // Page 3 of a 30-person group has nothing on it once the search narrows to
  // two matches, so a stale page index would show an empty table.
  it("returns to the first page when the search narrows", () => {
    renderTable({ group: GROUP, rows: manyMembers(30), currency: "SEK" })
    fireEvent.click(screen.getByRole("button", { name: m.toolbar.next }))
    fireEvent.change(screen.getByLabelText(m.detail.searchPlaceholder), {
      target: { value: "Person 0" },
    })
    expect(renderedNames()[0]).toBe("Person 00")
  })
})
