import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PayComparisonPoint } from "@/lib/pay-comparison"
import { onQuery } from "@/test/convex-mocks"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org_1", name: "Acme", role: "admin" }),
}))

import {
  PayComparisonSection,
  PayComparisonTooltip,
} from "./pay-comparison-section"

const m = messages.dashboard.people.payComparison
const mGender = messages.dashboard.people.gender

// A full chart point; override only what a case cares about.
function point(
  overrides: Partial<PayComparisonPoint> & { isSelf: boolean }
): PayComparisonPoint {
  return {
    publicId: "pub-x",
    displayName: "Bo Berg",
    gender: "Man",
    level: "IC2",
    basic: 42000,
    variable: 0,
    amount: 42000,
    payYear: 2026,
    ...overrides,
  }
}

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayComparisonSection personId={"p1" as never} trackKey="IC" />
    </NextIntlClientProvider>
  )
}

// Route the one query the section reads: the comparison payload.
function onQueries(comparison: unknown) {
  onQuery((ref) =>
    ref === "people.pay.getRolePayComparison" ? comparison : undefined
  )
}

describe("PayComparisonSection", () => {
  // Recharts' ResponsiveContainer measures its container via
  // getBoundingClientRect on mount; happy-dom has no layout, so it reads 0x0
  // and renders nothing inside the chart (legend included). Stub a nonzero
  // rect so the chart content (and its legend text) actually renders.
  beforeEach(() => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 640,
      bottom: 192,
      width: 640,
      height: 192,
      toJSON: () => ({}),
    } as DOMRect)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
  })

  it("shows the heading chrome and a skeleton while loading", () => {
    onQueries(undefined)
    renderSection()
    expect(screen.getByText(m.heading)).toBeDefined()
    expect(screen.getByText(m.scopeRole)).toBeDefined()
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull()
  })

  it("shows the precondition line for unclassified and noSalary", () => {
    onQueries({ status: "unclassified" })
    renderSection()
    expect(screen.getByText(m.precondition)).toBeDefined()
    cleanup()
    onQueries({ status: "noSalary" })
    renderSection()
    expect(screen.getByText(m.precondition)).toBeDefined()
  })

  it("shows the only-person line when self is the only point", () => {
    onQueries({
      status: "ready",
      currency: "SEK",
      excludedCount: 0,
      points: [point({ level: "IC3", isSelf: true })],
    })
    renderSection()
    expect(screen.getByText(m.onlyPerson)).toBeDefined()
  })

  it("shows the exclusion line, not the only-person line, when self is alone but peers were excluded", () => {
    onQueries({
      status: "ready",
      currency: "SEK",
      excludedCount: 2,
      points: [point({ level: "IC3", isSelf: true })],
    })
    renderSection()
    expect(
      screen.getByText("2 colleagues not shown (pay in another currency)")
    ).toBeDefined()
    expect(screen.queryByText(m.onlyPerson)).toBeNull()
  })

  it("renders the chart, footnote, exclusion line, and a Man/Woman legend for 2+ points", () => {
    onQueries({
      status: "ready",
      currency: "SEK",
      excludedCount: 2,
      points: [
        point({
          displayName: "Alex Doe",
          gender: "Kvinna",
          level: "IC3",
          isSelf: true,
        }),
        point({
          displayName: "Bo Berg",
          gender: "Man",
          level: "IC2",
          isSelf: false,
        }),
      ],
    })
    renderSection()
    expect(screen.getByText(m.footnote)).toBeDefined()
    expect(
      screen.getByText("2 colleagues not shown (pay in another currency)")
    ).toBeDefined()
    expect(document.querySelector("[data-chart]")).not.toBeNull()
    // Dots are colored by gender, so the legend labels the two gender series
    // (never color-alone); it no longer names individuals.
    expect(screen.getByText(mGender.Man)).toBeDefined()
    expect(screen.getByText(mGender.Kvinna)).toBeDefined()
  })

  it("hides the exclusion line when excludedCount is 0", () => {
    onQueries({
      status: "ready",
      currency: "SEK",
      excludedCount: 0,
      points: [
        point({ level: "IC3", isSelf: true }),
        point({ level: "IC2", isSelf: false }),
      ],
    })
    renderSection()
    expect(screen.queryByText(/not shown/)).toBeNull()
  })
})

function renderTooltip(props: {
  point: PayComparisonPoint
  selfAmount: number
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayComparisonTooltip
        point={props.point}
        selfAmount={props.selfAmount}
        currency="SEK"
      />
    </NextIntlClientProvider>
  )
}

describe("PayComparisonTooltip", () => {
  afterEach(() => {
    cleanup()
  })

  it("names a peer and shows level, year, split, and gap to this person", () => {
    renderTooltip({
      point: point({
        displayName: "Bo Berg",
        gender: "Man",
        level: "IC2",
        basic: 45000,
        variable: 5000,
        amount: 50000,
        payYear: 2026,
        isSelf: false,
      }),
      selfAmount: 60000,
    })
    // A peer is named but not brand-colored (only the viewed person is).
    const peerName = screen.getByText("Bo Berg")
    expect(peerName).toBeDefined()
    expect(peerName.className).not.toContain("text-brand")
    expect(screen.getByText("IC2 · 2026")).toBeDefined()
    // Gender is stated in the tooltip, not conveyed by dot color alone.
    expect(screen.getByText(mGender.Man)).toBeDefined()
    expect(screen.getByText("SEK 50,000")).toBeDefined()
    // Basic and variable share one line, so match the label as a substring.
    expect(screen.getByText(m.tooltipBasic, { exact: false })).toBeDefined()
    expect(screen.getByText(m.tooltipVariable, { exact: false })).toBeDefined()
    // 50000 - 60000 = -10000, shown as a signed gap to the viewed person.
    expect(screen.getByText(/vs this person/)).toBeDefined()
    expect(screen.getByText(/-SEK\s?10,000/)).toBeDefined()
  })

  it("names the viewed person, brand-colors it, and omits the self-comparison line", () => {
    renderTooltip({
      point: point({
        displayName: "Alex Doe",
        level: "IC3",
        amount: 60000,
        isSelf: true,
      }),
      selfAmount: 60000,
    })
    const selfName = screen.getByText("Alex Doe")
    expect(selfName).toBeDefined()
    expect(selfName.className).toContain("text-brand")
    expect(screen.queryByText(/vs this person/)).toBeNull()
  })

  it("shows only the total, without the split, when there is no variable pay", () => {
    renderTooltip({
      point: point({ variable: 0, basic: 42000, amount: 42000, isSelf: false }),
      selfAmount: 42000,
    })
    // The total renders; the basic/variable breakdown is omitted entirely
    // (with no variable, the total already is the basic).
    expect(screen.getByText("SEK 42,000")).toBeDefined()
    expect(screen.queryByText(m.tooltipBasic, { exact: false })).toBeNull()
    expect(screen.queryByText(m.tooltipVariable, { exact: false })).toBeNull()
  })
})
