import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { onQuery } from "@/test/convex-mocks"
import { pickSelectOption } from "@/test/select"

const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

import { AiUsageSection } from "@/components/admin/ai-usage-section"
import type { AiUsageOrgRow } from "@/lib/admin-ai-usage"

const t = messages.dashboard.admin.aiUsage
const tKpi = t.kpi

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

let currentRows: AiUsageOrgRow[] | undefined

function renderSection() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="Europe/Stockholm"
    >
      <AiUsageSection />
    </NextIntlClientProvider>
  )
}

describe("AiUsageSection", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-15T00:00:00Z"))
    currentRows = [
      row({
        orgId: "a",
        orgName: "Acme",
        costNanos: 2_000_000_000,
        callCount: 4,
        totalTokens: 1000,
        prevCostNanos: 1_000_000_000,
      }),
      row({
        orgId: "b",
        orgName: "Globex",
        costNanos: 500_000_000,
        callCount: 2,
        totalTokens: 500,
        prevCostNanos: 0,
      }),
    ]
    useQueryMock.mockReset()
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "platform.aiUsage.usageByOrg") return currentRows
      return undefined
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("shows the period selector defaulting to the current month", () => {
    renderSection()
    expect(
      screen.getByRole("combobox", { name: t.periodLabel }).textContent
    ).toContain("August 2026")
  })

  it("derives the KPI strip from the query rows", () => {
    renderSection()
    // Total cost: 2.00 + 0.50 = $2.50; total calls: 4 + 2 = 6; total tokens:
    // 1000 + 500 = 1500; active orgs: both have calls.
    expect(screen.getByText("$2.50")).toBeTruthy()
    expect(screen.getByText(tKpi.costLabel)).toBeTruthy()
    expect(screen.getByText("6")).toBeTruthy()
    expect(screen.getByText("1,500")).toBeTruthy()
    expect(screen.getByText(tKpi.activeOrgsLabel)).toBeTruthy()
  })

  it("shows tile skeletons while the query has not resolved", () => {
    currentRows = undefined
    renderSection()
    // The period selector and KPI labels are static chrome and render for
    // real; the figures are not there yet.
    expect(screen.getByText(tKpi.costLabel)).toBeTruthy()
    expect(screen.queryByText("$2.50")).toBeNull()
  })

  it("re-queries with the newly selected period", async () => {
    renderSection()
    // The period list is already memoized from the fake "now" above; switch
    // back to real timers so Testing Library's async polling (findByRole)
    // can resolve instead of waiting on a clock nothing is advancing.
    vi.useRealTimers()
    const trigger = screen.getByRole("combobox", { name: t.periodLabel })
    await pickSelectOption(trigger, "July 2026")
    expect(useQueryMock).toHaveBeenCalledWith("platform.aiUsage.usageByOrg", {
      period: "2026-07",
    })
  })
})
