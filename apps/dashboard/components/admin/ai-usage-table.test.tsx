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
  AiUsageTable,
  matchesOrgUsageQuery,
} from "@/components/admin/ai-usage-table"
import type { AiUsageOrgRow } from "@/lib/admin-ai-usage"

const t = messages.dashboard.admin.aiUsage
const tTable = t.table

function row(overrides: Partial<AiUsageOrgRow>): AiUsageOrgRow {
  return {
    orgId: "org-a",
    orgName: "Acme",
    costNanos: 0,
    callCount: 0,
    totalTokens: 0,
    byKind: {},
    prevCostNanos: 0,
    ...overrides,
  }
}

function renderTable(props: Partial<Parameters<typeof AiUsageTable>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AiUsageTable
        rows={props.rows}
        outliers={props.outliers ?? new Set()}
        totalCostNanos={props.totalCostNanos ?? 0}
      />
    </NextIntlClientProvider>
  )
}

afterEach(cleanup)

describe("matchesOrgUsageQuery", () => {
  it("matches a case-insensitive substring of the org name", () => {
    expect(matchesOrgUsageQuery({ orgName: "Acme Corp" }, "acme")).toBe(true)
    expect(matchesOrgUsageQuery({ orgName: "Acme Corp" }, "globex")).toBe(false)
  })

  it("matches everything for an empty query", () => {
    expect(matchesOrgUsageQuery({ orgName: "Acme" }, "  ")).toBe(true)
  })
})

describe("AiUsageTable", () => {
  it("shows a content-shaped skeleton while loading, with the live search field", () => {
    renderTable({ rows: undefined })
    expect(
      screen.getByRole("textbox", { name: tTable.searchPlaceholder })
    ).toBeTruthy()
    expect(screen.getByRole("table")).toBeTruthy()
  })

  it("shows the empty sentence when the period has no usage at all, titled by the page heading", () => {
    renderTable({ rows: [] })
    expect(screen.getByText(t.empty)).toBeTruthy()
    // The page heading, not the "Organization" column header (review Minor
    // #3): matches the roles/people/email-log precedent.
    expect(screen.getByText(t.heading)).toBeTruthy()
    expect(screen.queryByRole("table")).toBeNull()
  })

  it("sorts by cost descending by default", () => {
    renderTable({
      rows: [
        row({ orgId: "a", orgName: "Small Spender", costNanos: 100 }),
        row({ orgId: "b", orgName: "Big Spender", costNanos: 5_000_000_000 }),
      ],
    })
    const names = screen
      .getAllByRole("row")
      .slice(1) // drop the header row
      .map((r) => within(r).getAllByRole("cell")[0]?.textContent)
    expect(names).toEqual(["Big Spender", "Small Spender"])
  })

  it("shows a flagged badge only on outlier rows", () => {
    renderTable({
      rows: [
        row({ orgId: "a", orgName: "Quiet Co", costNanos: 100_000_000 }),
        row({ orgId: "b", orgName: "Big Spender", costNanos: 20_000_000_000 }),
      ],
      outliers: new Set(["b"]),
    })
    const rows = screen.getAllByRole("row").slice(1)
    const bigRow = rows.find((r) => within(r).queryByText("Big Spender"))
    const quietRow = rows.find((r) => within(r).queryByText("Quiet Co"))
    expect(bigRow && within(bigRow).queryByText(tTable.flagged)).toBeTruthy()
    expect(quietRow && within(quietRow).queryByText(tTable.flagged)).toBeNull()
  })

  it("shows a 'new' badge instead of a percent for an org with no previous cost", () => {
    renderTable({
      rows: [
        row({
          orgId: "a",
          orgName: "Fresh Co",
          costNanos: 100,
          prevCostNanos: 0,
        }),
      ],
    })
    expect(screen.getByText(tTable.new)).toBeTruthy()
  })

  it("renders the byKind split as chips", () => {
    renderTable({
      rows: [
        row({
          orgId: "a",
          orgName: "Acme",
          byKind: { "model.draft": 3, "role.profile": 1 },
        }),
      ],
    })
    expect(screen.getByText("model.draft 3")).toBeTruthy()
    expect(screen.getByText("role.profile 1")).toBeTruthy()
  })

  it("filters rows by the search field", () => {
    renderTable({
      rows: [
        row({ orgId: "a", orgName: "Acme" }),
        row({ orgId: "b", orgName: "Globex" }),
      ],
    })
    fireEvent.change(
      screen.getByRole("textbox", { name: tTable.searchPlaceholder }),
      { target: { value: "globex" } }
    )
    expect(screen.queryByText("Acme")).toBeNull()
    expect(screen.getByText("Globex")).toBeTruthy()
  })

  it("shows the no-matches state when a search matches nothing, titled by the page heading", () => {
    renderTable({ rows: [row({ orgId: "a", orgName: "Acme" })] })
    fireEvent.change(
      screen.getByRole("textbox", { name: tTable.searchPlaceholder }),
      { target: { value: "nope" } }
    )
    expect(screen.getByText(tTable.noMatches)).toBeTruthy()
    expect(screen.getByText(t.heading)).toBeTruthy()
  })

  it("states the flagging rule in a caption once rows resolve", () => {
    renderTable({ rows: [row({ orgId: "a", orgName: "Acme" })] })
    expect(screen.getByText(tTable.flaggedCaption)).toBeTruthy()
  })

  it("paginates past 25 rows", () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      row({ orgId: `org-${i}`, orgName: `Org ${String(i).padStart(2, "0")}` })
    )
    renderTable({ rows })
    // 25 data rows + 1 header row on the first page.
    expect(screen.getAllByRole("row")).toHaveLength(26)
    expect(screen.getByLabelText(tTable.next)).toBeTruthy()
  })
})
