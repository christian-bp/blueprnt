import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import {
  matchesSnapshotRowQuery,
  PayMappingDetail,
  type PayMappingRunDetail,
  type PayMappingSnapshotRow,
} from "@/components/pay-mapping/pay-mapping-detail"

const m = messages.dashboard.payMapping

const RUN: PayMappingRunDetail = {
  runId: "run1" as PayMappingRunDetail["runId"],
  label: "Lonekartlaggning 2026",
  status: "active",
  referenceDate: Date.UTC(2026, 6, 1),
  initiatedBy: "user1",
  initiatedByName: "Anna Svensson",
  populationCount: 5,
  withPayCount: 3,
  unclassifiedExcludedCount: 2,
  populationNote: null,
  rows: [
    {
      displayName: "Erik Persson",
      erased: false,
      gender: "Man",
      roleTitle: "Backend engineer",
      trackKey: "IC",
      level: "P2",
      band: 4,
      basicMonthly: 45000,
      currency: "SEK",
    },
    {
      displayName: "Removed person",
      erased: true,
      gender: "Kvinna",
      roleTitle: "Product manager",
      trackKey: "IC",
      level: "P3",
      band: null,
      basicMonthly: null,
    },
  ],
}

function renderDetail(run: PayMappingRunDetail = RUN) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayMappingDetail orgId="org-1" run={run} />
    </NextIntlClientProvider>
  )
}

describe("PayMappingDetail", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the run metadata", () => {
    renderDetail()
    // The label appears three times: the breadcrumb's current page, the page
    // heading, and the metadata field's dd value.
    expect(screen.getAllByText("Lonekartlaggning 2026")).toHaveLength(3)
    expect(screen.getByText(m.status.active)).toBeDefined()
    expect(screen.getByText("Anna Svensson")).toBeDefined()
    expect(screen.getByText("5")).toBeDefined()
    expect(screen.getByText("3")).toBeDefined()
    expect(screen.getByText("2")).toBeDefined()
  })

  it("renders a breadcrumb linking back to the pay mappings list", () => {
    renderDetail()
    const listLink = screen.getByRole("link", { name: m.heading })
    expect(listLink.getAttribute("href")).toBe("/pay-mappings")

    // The run label is the current (non-link) breadcrumb page, distinct from
    // the same label rendered as the heading and the metadata dd value.
    const current = screen
      .getAllByText("Lonekartlaggning 2026")
      .find((el) => el.getAttribute("aria-current") === "page")
    expect(current).toBeDefined()
    expect(current?.getAttribute("href")).toBeNull()
  })

  it("renders one row per snapshot row, showing the erased label for an erased row", () => {
    renderDetail()
    expect(screen.getByText("Erik Persson")).toBeDefined()
    expect(screen.getByText("Backend engineer")).toBeDefined()
    expect(screen.getByText("Product manager")).toBeDefined()

    // The erased row shows the erased label, never the real name.
    expect(screen.getByText(m.detail.erased)).toBeDefined()
    expect(screen.queryByText("Removed person")).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // Search and pagination
  // ---------------------------------------------------------------------------

  it("search narrows population rows by name and role", () => {
    renderDetail()
    const search = screen.getByLabelText(m.detail.searchPlaceholder)

    fireEvent.change(search, { target: { value: "erik" } })
    expect(screen.getByText("Erik Persson")).toBeDefined()
    expect(screen.queryByText(m.detail.erased)).toBeNull()

    fireEvent.change(search, { target: { value: "product manager" } })
    expect(screen.queryByText("Erik Persson")).toBeNull()
    expect(screen.getByText(m.detail.erased)).toBeDefined()
  })

  it("finds an erased row by the erased-label text, not the tombstoned name", () => {
    renderDetail()
    const search = screen.getByLabelText(m.detail.searchPlaceholder)
    fireEvent.change(search, { target: { value: "erased" } })
    expect(screen.getByText(m.detail.erased)).toBeDefined()
    expect(screen.queryByText("Erik Persson")).toBeNull()
  })

  it("shows the no-matches empty state and clears the search from it", () => {
    renderDetail()
    fireEvent.change(screen.getByLabelText(m.detail.searchPlaceholder), {
      target: { value: "zzz-no-match" },
    })
    expect(screen.getByText(m.toolbar.noMatches)).toBeDefined()

    fireEvent.click(
      screen.getByRole("button", { name: m.toolbar.clearFilters })
    )
    expect(screen.getByText("Erik Persson")).toBeDefined()
    expect(screen.getByText(m.detail.erased)).toBeDefined()
  })

  it("paginates the population past 25 rows and navigates with Next", () => {
    const manyRows: PayMappingRunDetail["rows"] = Array.from(
      { length: 30 },
      (_, i) => ({
        displayName: `Person ${String(i + 1).padStart(2, "0")}`,
        erased: false,
        gender: "Man" as const,
        roleTitle: "Backend engineer",
        trackKey: "IC",
        level: "P2",
        band: 3,
        basicMonthly: 40000,
        currency: "SEK",
      })
    )
    renderDetail({ ...RUN, rows: manyRows })

    // 1 header row + 25 data rows on the first page.
    expect(screen.getAllByRole("row")).toHaveLength(26)
    expect(screen.getByText("Person 01")).toBeDefined()
    expect(screen.queryByText("Person 26")).toBeNull()

    fireEvent.click(screen.getByLabelText(m.toolbar.next))
    expect(screen.getAllByRole("row")).toHaveLength(6)
    expect(screen.getByText("Person 26")).toBeDefined()
    expect(screen.queryByText("Person 01")).toBeNull()

    fireEvent.click(screen.getByLabelText(m.toolbar.previous))
    expect(screen.getByText("Person 01")).toBeDefined()
  })

  it("hides the pagination control when everything fits on one page", () => {
    renderDetail()
    expect(screen.queryByLabelText(m.toolbar.next)).toBeNull()
  })
})

describe("matchesSnapshotRowQuery", () => {
  const row: Pick<
    PayMappingSnapshotRow,
    "displayName" | "erased" | "roleTitle"
  > = {
    displayName: "Erik Persson",
    erased: false,
    roleTitle: "Backend engineer",
  }

  it("matches case-insensitive substrings of the name and role", () => {
    expect(matchesSnapshotRowQuery(row, "Erased", "erik")).toBe(true)
    expect(matchesSnapshotRowQuery(row, "Erased", "BACKEND")).toBe(true)
    expect(matchesSnapshotRowQuery(row, "Erased", "anna")).toBe(false)
  })

  it("matches everything on an empty or whitespace query", () => {
    expect(matchesSnapshotRowQuery(row, "Erased", "")).toBe(true)
    expect(matchesSnapshotRowQuery(row, "Erased", "   ")).toBe(true)
  })

  it("uses the erased label, never the tombstoned name, for an erased row", () => {
    const erasedRow = { ...row, erased: true, displayName: "Removed person" }
    expect(matchesSnapshotRowQuery(erasedRow, "Erased", "erased")).toBe(true)
    expect(matchesSnapshotRowQuery(erasedRow, "Erased", "removed")).toBe(false)
  })
})
