import { cleanup, fireEvent, render, screen } from "@testing-library/react"
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

import type {
  ExcludedGroupsWire,
  GapGroup,
  PayMappingSnapshotRow,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import { SupplementaryAnalysis } from "@/components/pay-mapping/supplementary-analysis"
import { makeExcluded, makeGapGroup } from "@/test/pay-mapping-fixtures"

const m = messages.dashboard.payMapping.supplementary

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

// Anna sits on level 2 (higher value) and is out-earned by Sven on level 3:
// one cross-level case.
const ROWS: PayMappingSnapshotRow[] = [
  row({
    personPublicId: "w1",
    displayName: "Anna Ask",
    gender: "Kvinna",
    basicMonthly: 45000,
  }),
  row({
    personPublicId: "m1",
    displayName: "Sven Svan",
    roleTitle: "Support",
    seniority: "Junior",
    level: 3,
    basicMonthly: 50000,
  }),
]

const EXCLUDED: ExcludedGroupsWire = makeExcluded({
  singletonCount: 42,
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
  genderPure: [
    {
      key: "Lead|1|Staff",
      roleTitle: "Lead",
      seniority: "Staff",
      level: 1,
      gender: "Man",
      count: 3,
    },
  ],
})

function renderDrawer(
  overrides: Partial<{
    excluded: ExcludedGroupsWire
    rows: PayMappingSnapshotRow[]
    equivalentWork: GapGroup[]
  }> = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SupplementaryAnalysis
        excluded={overrides.excluded ?? EXCLUDED}
        equivalentWork={overrides.equivalentWork ?? []}
        equalWork={[]}
        rows={overrides.rows ?? ROWS}
        currency="SEK"
      />
    </NextIntlClientProvider>
  )
}

// The drawer's triggers by their title, so a body match cannot be mistaken
// for the item itself.
function trigger(title: string) {
  return screen
    .getAllByRole("button")
    .find((button) => (button.textContent ?? "").startsWith(title))
}

describe("SupplementaryAnalysis", () => {
  afterEach(() => {
    cleanup()
  })

  it("claims nothing about the law, only about the gate", () => {
    renderDrawer()
    expect(screen.getByText(m.heading)).toBeDefined()
    expect(screen.getByText(m.lead)).toBeDefined()
    // A cross-level pair carries actions that belong to the statutory
    // action plan, so "not required by law" would be false.
    expect(screen.queryByText(/not required by law/i)).toBeNull()
  })

  it("lists all five analyses with their counts, closed", () => {
    renderDrawer()
    for (const title of Object.values(m.items)) {
      expect(trigger(title)).toBeDefined()
    }
    expect(trigger(m.items.singletons)?.textContent).toContain("42")
    expect(trigger(m.items.crossLevel)?.textContent).toContain("1")
    // Closed: no body content until the user opens one.
    expect(screen.queryByText("Anna Ask")).toBeNull()
  })

  it("opens one item at a time", () => {
    renderDrawer()
    fireEvent.click(trigger(m.items.crossLevel) as HTMLElement)
    expect(screen.getByText("Anna Ask")).toBeDefined()
    fireEvent.click(trigger(m.items.genderPure) as HTMLElement)
    // The previous item's content is gone: one thing open per rung.
    expect(screen.queryByText("Anna Ask")).toBeNull()
    expect(screen.getByText("Lead · Staff")).toBeDefined()
  })

  it("tints only a real cross-level count", () => {
    // The accordion's own chevron is a brand-tinted svg; the count is a
    // span, so scope the query to spans.
    const tintedCount = (title: string) =>
      trigger(title)?.querySelector("span.text-brand")
    const { unmount } = renderDrawer()
    expect(tintedCount(m.items.crossLevel)?.textContent).toBe("1")
    expect(tintedCount(m.items.singletons)).toBeNull()
    unmount()
    renderDrawer({ rows: [] })
    expect(tintedCount(m.items.crossLevel)).toBeNull()
  })

  it("states the result of an empty check instead of hiding it", () => {
    renderDrawer({ excluded: makeExcluded(), rows: [] })
    fireEvent.click(trigger(m.items.crossLevel) as HTMLElement)
    expect(screen.getByText(m.empty.crossLevel)).toBeDefined()
    fireEvent.click(trigger(m.items.singletons) as HTMLElement)
    expect(screen.getByText(m.empty.singletons)).toBeDefined()
  })
})
